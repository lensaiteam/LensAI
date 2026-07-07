import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { normalizeTicker } from "@/lib/market";
import { fetchCandleSeries } from "@/lib/market/coinbase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// range (days) -> Coinbase granularity (secs) + how many candles to keep.
const RANGES: Record<string, { g: number; n: number }> = {
  "7": { g: 21600, n: 28 }, // 6h candles
  "30": { g: 86400, n: 30 }, // daily
  "90": { g: 86400, n: 90 }, // daily
};

// GET /api/candles?ticker=ETH&range=30 -> { points: [{t, c}] }
export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const ticker = normalizeTicker(url.searchParams.get("ticker") ?? "");
  if (!ticker) return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });

  const cfg = RANGES[url.searchParams.get("range") ?? "30"] ?? RANGES["30"];
  const points = await fetchCandleSeries(ticker, cfg.g, cfg.n);

  return NextResponse.json(
    { points: points ?? [] },
    { headers: { "Cache-Control": "private, max-age=120" } },
  );
}
