import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { runPrecompute, TOP_TOKENS } from "@/lib/precompute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const Body = z.object({
  tokens: z.array(z.string()).optional(),
  concurrency: z.number().int().min(1).max(8).optional(),
});

/**
 * Background top-token refresh (spec §4.2–4.3). Protected by CRON_SECRET.
 * Runs through the provider gateway with a concurrency cap. Schedule this every
 * 30–60 min (e.g. Vercel Cron). Keep the token set small enough to finish within
 * the host's maxDuration — chunk across calls if needed.
 *
 *   POST { tokens?: string[], concurrency?: number }  ->  { total, written, failed }
 */
export async function POST(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (token !== env.cronSecret()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const result = await runPrecompute(parsed.data.tokens ?? TOP_TOKENS, parsed.data.concurrency ?? 3);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/precompute]", err);
    return NextResponse.json({ error: "Precompute failed" }, { status: 500 });
  }
}
