import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { submitPrecomputeBatch, collectPrecomputeBatch, TOP_TOKENS } from "@/lib/precompute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const Body = z.object({
  mode: z.enum(["submit", "collect"]),
  batchId: z.string().optional(),
  tokens: z.array(z.string()).optional(),
});

/**
 * Background top-token refresh (CLAUDE.md §4.2–4.4). Protected by CRON_SECRET.
 * Two phases because the Batch API is asynchronous:
 *   POST { mode: "submit" }               -> returns { batchId }
 *   POST { mode: "collect", batchId }     -> writes finished results to cache
 * Schedule "submit" every 30–60 min and "collect" a few minutes later (or poll).
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (token !== env.cronSecret()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    if (parsed.data.mode === "submit") {
      const batchId = await submitPrecomputeBatch(parsed.data.tokens ?? TOP_TOKENS);
      return NextResponse.json({ batchId, submitted: (parsed.data.tokens ?? TOP_TOKENS).length });
    }

    if (!parsed.data.batchId) {
      return NextResponse.json({ error: "batchId required for collect" }, { status: 400 });
    }
    const result = await collectPrecomputeBatch(parsed.data.batchId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/precompute]", err);
    return NextResponse.json({ error: "Precompute failed" }, { status: 500 });
  }
}
