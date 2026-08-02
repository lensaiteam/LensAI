import type { FactorAdapter, FactorResult } from "./types";
import type { FactorSource } from "../sources";
import type { ObservationInput } from "../types";
import { httpJson } from "./http";

const BASE = "https://api.bybit.com";

function baseAsset(instrument: string): string {
  return instrument.replace(/USDT$|USDC$|USD$/i, "") || instrument;
}

interface TickersResp {
  retCode: number;
  retMsg: string;
  result: { list: TickerItem[] };
}
interface TickerItem {
  symbol: string;
  fundingRate: string;
  markPrice: string;
  openInterest: string;
  openInterestValue: string;
  nextFundingTime: string;
}

async function ticker(instrument: string): Promise<TickerItem> {
  const d = await httpJson<TickersResp>(`${BASE}/v5/market/tickers?category=linear&symbol=${instrument}`);
  if (d.retCode !== 0) throw new Error(`bybit retCode ${d.retCode}: ${d.retMsg}`);
  const item = d.result?.list?.[0];
  if (!item) throw new Error(`bybit: no ticker for ${instrument}`);
  return item;
}

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

export const bybitFunding: FactorAdapter = (cfg, ctx) =>
  perInstrument(cfg, async (instrument) => {
    const t = await ticker(instrument);
    return {
      stream: "funding_rate",
      source: "bybit",
      asset: baseAsset(instrument),
      instrument,
      value: parseFloat(t.fundingRate),
      unit: "rate_8h",
      observedAt: ctx.slot,
      metadata: { markPrice: parseFloat(t.markPrice), nextFundingTime: Number(t.nextFundingTime) },
    } satisfies ObservationInput;
  });

export const bybitOpenInterest: FactorAdapter = (cfg, ctx) =>
  perInstrument(cfg, async (instrument) => {
    const t = await ticker(instrument);
    return {
      stream: "open_interest",
      source: "bybit",
      asset: baseAsset(instrument),
      instrument,
      value: parseFloat(t.openInterest),
      unit: "base",
      observedAt: ctx.slot,
      metadata: { openInterestValueUsd: parseFloat(t.openInterestValue) },
    } satisfies ObservationInput;
  });
