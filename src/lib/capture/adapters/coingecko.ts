import type { FactorAdapter, FactorResult } from "./types";
import type { ObservationInput } from "../types";
import { httpJson } from "./http";

const BASE = "https://api.coingecko.com/api/v3";

export type SimplePrice = Record<
  string,
  { usd: number; usd_market_cap?: number; usd_24h_vol?: number; usd_24h_change?: number }
>;

/**
 * Pure: /simple/price payload -> spot_price + spot_volume observations per id.
 * Asset is the CoinGecko id (source-native; cross-source symbol mapping is Phase 2).
 */
export function parseSimplePrice(ids: string[], data: SimplePrice, slot: number): FactorResult {
  const observations: ObservationInput[] = [];
  const errors: string[] = [];
  for (const id of ids) {
    const d = data[id];
    if (!d || typeof d.usd !== "number") {
      errors.push(`coingecko_spot ${id}: missing in response`);
      continue;
    }
    const common = { source: "coingecko", asset: id, instrument: "", observedAt: slot };
    observations.push({
      ...common,
      stream: "spot_price",
      value: d.usd,
      unit: "usd",
      metadata: { marketCapUsd: d.usd_market_cap ?? null, change24hPct: d.usd_24h_change ?? null },
    });
    if (typeof d.usd_24h_vol === "number") {
      observations.push({ ...common, stream: "spot_volume", value: d.usd_24h_vol, unit: "usd", metadata: null });
    }
  }
  return { observations, errors };
}

export const coingeckoSpot: FactorAdapter = async (cfg, ctx): Promise<FactorResult> => {
  const ids = cfg.assets ?? [];
  if (ids.length === 0) return { observations: [], errors: [`${cfg.id}: no assets configured`] };
  const url = `${BASE}/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`;
  try {
    const data = await httpJson<SimplePrice>(url);
    return parseSimplePrice(ids, data, ctx.slot);
  } catch (e) {
    return { observations: [], errors: [`${cfg.id}: ${(e as Error).message}`] };
  }
};
