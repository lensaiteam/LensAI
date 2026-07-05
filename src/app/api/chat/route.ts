import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rateLimit";
import { sessionOwnedBy, addMessage, getMessages } from "@/lib/sessions";
import { getCachedToken } from "@/lib/cache/tokenCache";
import { resolveFromStored } from "@/lib/chat/resolve";
import { streamFollowup } from "@/lib/chat/followup";
import { logUsage } from "@/lib/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({ sessionId: z.string().uuid(), message: z.string().min(1).max(2000) });

// POST /api/chat { sessionId, message } -> streamed follow-up answer
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const wallet = auth.walletAddress;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { sessionId, message } = parsed.data;

  const owned = await sessionOwnedBy(sessionId, wallet);
  if (!owned) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const rl = await checkRateLimit(wallet, { limit: 40, windowMs: 10 * 60_000 });
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  await addMessage(sessionId, "user", message);

  const cached = await getCachedToken(owned.ticker);
  const encoder = new TextEncoder();

  // Zero-cost path: answer from a stored field if fresh (§5.4).
  if (cached) {
    const stored = resolveFromStored(cached, message);
    if (stored) {
      await addMessage(sessionId, "assistant", stored);
      await logUsage({
        sessionId,
        walletAddress: wallet,
        model: "stored-field",
        inputTokens: 0,
        outputTokens: 0,
        webSearches: 0,
        cacheHit: true,
      });
      return streamOnce(stored, sessionId, "stored");
    }
  }

  // Fall-through: Haiku follow-up over already-gathered context (no new search).
  const history = await getMessages(sessionId, 20);
  // Drop the just-added user message from history (we pass it separately).
  const priorHistory = history.slice(0, -1);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const result = await streamFollowup(
          cached,
          owned.ticker,
          priorHistory,
          message,
          (delta) => controller.enqueue(encoder.encode(delta)),
        );
        await Promise.all([
          addMessage(sessionId, "assistant", result.text),
          logUsage({
            sessionId,
            walletAddress: wallet,
            model: result.model,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            webSearches: 0,
            cacheHit: false,
          }),
        ]);
      } catch (err) {
        console.error("[chat] followup error", err);
        controller.enqueue(encoder.encode("\n\n_An error occurred._"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "x-lensai-session": sessionId,
      "x-lensai-resolved": "model",
    },
  });
}

function streamOnce(text: string, sessionId: string, resolved: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "x-lensai-session": sessionId,
      "x-lensai-resolved": resolved,
    },
  });
}
