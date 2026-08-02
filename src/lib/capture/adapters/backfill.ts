import type { FactorSource } from "../sources";
import type { ObservationInput } from "../types";
import { captureConfig } from "../config";
import { httpJson } from "./http";
import { baseAsset } from "./binance";

/**
 * Backfill adapters — import REAL historical data (never fabricated) from sources
 * that publish it. Rows are inserted with is_backfill=1 and captured_at=now; the
 * point-in-time DAL keeps them honest. Articles and depth are NOT backfillable
 * (no historical feed) — forward capture only.
 */

const FAPI = "https://fapi.binance.com";
const CG = "https://api.coingecko.com/api/v3";
const FRED = "https://api.stlouisfed.org/fred/series/observations";

export interface BackfillContext {
  now: number;
  /** lookback hint for sources that take one (e.g. coingecko days). */
  limit?: number;
}
export interface BackfillResult {
  observations: ObservationInput[];
  errors: string[];
}
export type BackfillAdapter = (cfg: FactorSource, ctx: BackfillContext) => Promise<BackfillResult>;

async function gather<T>(items: T[], fn: (item: T) => Promise<ObservationInput[]>, label: (item: T) => string): Promise<BackfillResult> {
  const observations: ObservationInput[] = [];
  const errors: string[] = [];
  const settled = await Promise.allSettled(items.map(fn));
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") observations.push(...r.value);
    else errors.push(`${label(items[i])}: ${(r.reason as Error).message}`);
  });
  return { observations, errors };
}

// ── Binance funding history ─────────────────────────────────────────────────
export interface FundingHist { symbol: string; fundingTime: number; fundingRate: string }
export function parseFundingHistory(instrument: string, rows: FundingHist[]): ObservationInput[] {
  return rows.map((r) => ({
    stream: "funding_rate", source: "binance", asset: baseAsset(instrument), instrument,
    value: parseFloat(r.fundingRate), unit: "rate_8h", observedAt: r.fundingTime, metadata: null,
  }));
}
export const binanceFundingHistory: BackfillAdapter = (cfg) => {
  const ins = cfg.instruments ?? [];
  if (!ins.length) return Promise.resolve({ observations: [], errors: [`${cfg.id}: no instruments configured`] });
  return gather(ins, async (sym) => parseFundingHistory(sym, await httpJson<FundingHist[]>(`${FAPI}/fapi/v1/fundingRate?symbol=${sym}&limit=1000`)), (s) => `${cfg.id} ${s}`);
};

// ── Binance open-interest history ───────────────────────────────────────────
export interface OiHist { symbol: string; sumOpenInterest: string; sumOpenInterestValue: string; timestamp: number }
export function parseOiHistory(instrument: string, rows: OiHist[]): ObservationInput[] {
  return rows.map((r) => ({
    stream: "open_interest", source: "binance", asset: baseAsset(instrument), instrument,
    value: parseFloat(r.sumOpenInterest), unit: "base", observedAt: r.timestamp,
    metadata: { openInterestValueUsd: parseFloat(r.sumOpenInterestValue) },
  }));
}
export const binanceOpenInterestHistory: BackfillAdapter = (cfg) => {
  const ins = cfg.instruments ?? [];
  if (!ins.length) return Promise.resolve({ observations: [], errors: [`${cfg.id}: no instruments configured`] });
  return gather(ins, async (sym) => parseOiHistory(sym, await httpJson<OiHist[]>(`${FAPI}/futures/data/openInterestHist?symbol=${sym}&period=1d&limit=500`)), (s) => `${cfg.id} ${s}`);
};

// ── CoinGecko historical price + volume ─────────────────────────────────────
export interface MarketChart { prices: [number, number][]; total_volumes: [number, number][] }
export function parseMarketChart(id: string, d: MarketChart): ObservationInput[] {
  const obs: ObservationInput[] = [];
  for (const [ms, price] of d.prices ?? []) obs.push({ stream: "spot_price", source: "coingecko", asset: id, instrument: "", value: price, unit: "usd", observedAt: ms, metadata: null });
  for (const [ms, vol] of d.total_volumes ?? []) obs.push({ stream: "spot_volume", source: "coingecko", asset: id, instrument: "", value: vol, unit: "usd", observedAt: ms, metadata: null });
  return obs;
}
export const coingeckoMarketChartHistory: BackfillAdapter = (cfg, ctx) => {
  const ids = cfg.assets ?? [];
  if (!ids.length) return Promise.resolve({ observations: [], errors: [`${cfg.id}: no assets configured`] });
  const days = ctx.limit ?? 365;
  return gather(ids, async (id) => parseMarketChart(id, await httpJson<MarketChart>(`${CG}/coins/${id}/market_chart?vs_currency=usd&days=${days}&interval=daily`)), (id) => `${cfg.id} ${id}`);
};

// ── FRED full series ────────────────────────────────────────────────────────
export interface FredObs { date: string; value: string }
export function parseFredSeries(p: { series: string; asset: string; stream: string }, rows: FredObs[]): { observations: ObservationInput[]; skipped: number } {
  const unit = p.stream === "macro_rate" ? "percent" : "index";
  const observations: ObservationInput[] = [];
  let skipped = 0;
  for (const o of rows) {
    if (o.value === "." || o.value === "") { skipped++; continue; }
    const v = parseFloat(o.value);
    if (!Number.isFinite(v)) { skipped++; continue; }
    observations.push({ stream: p.stream, source: "fred", asset: p.asset, instrument: "", value: v, unit, observedAt: Date.parse(`${o.date}T00:00:00Z`), metadata: { series: p.series, referenceDate: o.date } });
  }
  return { observations, skipped };
}
export const fredFullSeries: BackfillAdapter = async (cfg) => {
  const key = captureConfig.fredApiKey();
  if (!key) return { observations: [], errors: [`${cfg.id}: FRED_API_KEY not set (see KEYS_NEEDED.md)`] };
  const series = (cfg.series as string) ?? "";
  if (!series) return { observations: [], errors: [`${cfg.id}: no 'series' configured`] };
  const asset = (cfg.asset as string) ?? series;
  try {
    const d = await httpJson<{ observations: FredObs[] }>(`${FRED}?series_id=${series}&api_key=${key}&file_type=json&sort_order=asc`);
    const { observations, skipped } = parseFredSeries({ series, asset, stream: cfg.stream }, d.observations ?? []);
    return { observations, errors: skipped ? [`${cfg.id}: skipped ${skipped} missing prints`] : [] };
  } catch (e) {
    return { observations: [], errors: [`${cfg.id}: ${(e as Error).message}`] };
  }
};

// ── Registry (keyed by the forward adapter name in config) ──────────────────
export const backfillAdapters: Record<string, BackfillAdapter> = {
  binanceFunding: binanceFundingHistory,
  binanceOpenInterest: binanceOpenInterestHistory,
  coingeckoSpot: coingeckoMarketChartHistory,
  fred: fredFullSeries,
};
export function getBackfillAdapter(name: string): BackfillAdapter | undefined {
  return backfillAdapters[name];
}
