import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rateLimit";
import { normalizeTicker, gatherMarketData } from "@/lib/market";
import { getCachedToken, writeCachedToken } from "@/lib/cache/tokenCache";
import { hasFreeCreditsLeft, consumeFreeCredit } from "@/lib/freeTier";
import { streamAnalysis } from "@/lib/ai/analyze";
import { buildDigest } from "@/lib/news/digest";
import { createSession, addMessage } from "@/lib/sessions";
import { logUsage } from "@/lib/usage";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({ ticker: z.string().min(1).max(40) });

// Free-tier users run on Haiku (spec §4.6); paid users would escalate to Sonnet.
function pickModel(isPaid: boolean): string {
  return isPaid ? env.analysisModel() : env.chatModel();
}

// POST /api/analyze { ticker } -> streamed markdown analysis
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const wallet = auth.walletAddress;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const ticker = normalizeTicker(parsed.data.ticker);
  if (!ticker) return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });

  // Rate limit: 20 analyses / 10 min per wallet (§13).
  const rl = await checkRateLimit(wallet, { limit: 20, windowMs: 10 * 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded", resetAt: rl.resetAt }, { status: 429 });
  }

  // 1. Cache check — served for ~$0 and does NOT consume a free credit (§5.3).
  const cached = await getCachedToken(ticker);
  if (cached) {
    const sessionId = await createSession(wallet, ticker);
    await addMessage(sessionId, "user", `Analyze ${ticker}`);
    await addMessage(sessionId, "assistant", cached.analysis.markdown);
    await logUsage({
      sessionId,
      walletAddress: wallet,
      model: cached.model ?? "cache",
      inputTokens: 0,
      outputTokens: 0,
      webSearches: 0,
      cacheHit: true,
    });
    return streamText(cached.analysis.markdown, {
      "x-lensai-session": sessionId,
      "x-lensai-ticker": ticker,
      "x-lensai-cache-hit": "1",
      "x-lensai-as-of": cached.generated_at,
      "x-lensai-signal": cached.analysis.signal,
    });
  }

  // 2. Cache miss — enforce the free tier before running the paid pipeline (§5.3, server-side).
  const isPaid = false; // paid tier not implemented yet
  if (!isPaid && !(await hasFreeCreditsLeft(wallet))) {
    return NextResponse.json(
      { error: "Free analyses used up. Upgrade to continue.", code: "FREE_TIER_EXHAUSTED" },
      { status: 402 },
    );
  }

  // 3. Gather market data (graceful fallback; never throws for unknown tickers).
  const marketData = await gatherMarketData(ticker);

  const sessionId = await createSession(wallet, ticker);
  await addMessage(sessionId, "user", `Analyze ${ticker}`);

  const model = pickModel(isPaid);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const result = await streamAnalysis(
          { ticker, marketData, newsDigest: null, model },
          (delta) => controller.enqueue(encoder.encode(delta)),
        );

        // Persist: structured cache, history, usage, and consume the free credit.
        const digest = buildDigest(result.news, result.webSearches > 0 ? "web_search" : "none", result.webSearches);
        await Promise.all([
          writeCachedToken({
            ticker,
            analysis: result.analysis,
            marketData,
            newsDigest: digest,
            sentiment: result.sentiment,
            tokenomics: result.tokenomics,
            riskFlags: result.riskFlags,
            model: result.model,
          }),
          addMessage(sessionId, "assistant", result.analysis.markdown),
          logUsage({
            sessionId,
            walletAddress: wallet,
            model: result.model,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            webSearches: result.webSearches,
            cacheHit: false,
          }),
        ]);
        if (!isPaid) await consumeFreeCredit(wallet);
      } catch (err) {
        console.error("[analyze] pipeline error", err);
        controller.enqueue(encoder.encode("\n\n_An error occurred while generating the analysis._"));
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
      "x-lensai-ticker": ticker,
      "x-lensai-cache-hit": "0",
    },
  });
}

/** Stream a stored string back with the same content-type as a live analysis. */
function streamText(text: string, headers: Record<string, string>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}
