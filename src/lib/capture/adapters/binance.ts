import type { FactorAdapter, FactorResult } from "./types";
import type { FactorSource } from "../sources";
import type { ObservationInput } from "../types";
import { httpJson } from "./http";

const FAPI = "https://fapi.binance.com";

/** Base asset from a perp symbol: "BTCUSDT" -> "BTC". */
export function baseAsset(instrument: string): string {
  return instrument.replace(/USDT$|USDC$|BUSD$|USD$/i, "") || instrument;
}

/** Run `fn` per configured instrument, collecting successes and errors. */
async function perInstrument(
  cfg: FactorSource,
  fn: (instrument: string) => Promise<ObservationInput>,
): Promise<FactorResult> {
  const instruments = cfg.instruments ?? [];
  const observations: ObservationInput[] = [];
  const errors: string[] = [];
  const settled = await Promise.allSettled(instruments.map(fn));
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") observations.push(r.value);
    else errors.push(`${cfg.id} ${instruments[i]}: ${(r.reason as Error).message}`);
  });
  if (instruments.length === 0) errors.push(`${cfg.id}: no instruments configured`);
  return { observations, errors };
}

export interface PremiumIndex { symbol: string; markPrice: string; indexPrice: string; lastFundingRate: string; nextFundingTime: number; time: number; }

/** Pure: premiumIndex payload -> funding observation. */
export function parseFunding(instrument: string, d: PremiumIndex, slot: number): ObservationInput {
  return {
    stream: "funding_rate",
    source: "binance",
    asset: baseAsset(instrument),
    instrument,
    value: parseFloat(d.lastFundingRate),
    unit: "rate_8h",
    observedAt: slot,
    metadata: {
      markPrice: parseFloat(d.markPrice),
      indexPrice: parseFloat(d.indexPrice),
      nextFundingTime: d.nextFundingTime,
      exchangeTime: d.time,
    },
  };
}

export const binanceFunding: FactorAdapter = (cfg, ctx) =>
  perInstrument(cfg, async (instrument) => {
    const d = await httpJson<PremiumIndex>(`${FAPI}/fapi/v1/premiumIndex?symbol=${instrument}`);
    return parseFunding(instrument, d, ctx.slot);
  });

export interface OpenInterest { symbol: string; openInterest: string; time: number; }

/** Pure: openInterest payload -> observation. */
export function parseOpenInterest(instrument: string, d: OpenInterest, slot: number): ObservationInput {
  return {
    stream: "open_interest",
    source: "binance",
    asset: baseAsset(instrument),
    instrument,
    value: parseFloat(d.openInterest),
    unit: "base",
    observedAt: slot,
    metadata: { exchangeTime: d.time },
  };
}

export const binanceOpenInterest: FactorAdapter = (cfg, ctx) =>
  perInstrument(cfg, async (instrument) => {
    const d = await httpJson<OpenInterest>(`${FAPI}/fapi/v1/openInterest?symbol=${instrument}`);
    return parseOpenInterest(instrument, d, ctx.slot);
  });

/** Sum quote-notional resting within a price band. Pure — unit-tested. */
export function computeDepth(bids: [string, string][], asks: [string, string][]) {
  if (!bids.length || !asks.length) throw new Error("empty order book");
  const bestBid = parseFloat(bids[0][0]);
  const bestAsk = parseFloat(asks[0][0]);
  const mid = (bestBid + bestAsk) / 2;
  const notional = (levels: [string, string][], lo: number, hi: number) =>
    levels.reduce((sum, [p, q]) => {
      const price = parseFloat(p);
      return price >= lo && price <= hi ? sum + price * parseFloat(q) : sum;
    }, 0);
  return {
    mid,
    bid_1pct_usd: notional(bids, mid * 0.99, mid),
    ask_1pct_usd: notional(asks, mid, mid * 1.01),
    bid_2pct_usd: notional(bids, mid * 0.98, mid),
    ask_2pct_usd: notional(asks, mid, mid * 1.02),
  };
}

export interface DepthResp { bids: [string, string][]; asks: [string, string][]; }

/** Pure: order book -> depth observation. */
export function parseDepth(instrument: string, d: DepthResp, slot: number): ObservationInput {
  return {
    stream: "depth",
    source: "binance",
    asset: baseAsset(instrument),
    instrument,
    value: null, // depth carries its numbers in metadata (±1%/±2% notional)
    unit: "usd",
    observedAt: slot,
    metadata: computeDepth(d.bids, d.asks),
  };
}

export const binanceDepth: FactorAdapter = (cfg, ctx) =>
  perInstrument(cfg, async (instrument) => {
    const d = await httpJson<DepthResp>(`${FAPI}/fapi/v1/depth?symbol=${instrument}&limit=1000`);
    return parseDepth(instrument, d, ctx.slot);
  });
