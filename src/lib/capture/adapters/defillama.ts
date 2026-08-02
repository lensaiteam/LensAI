import type { FactorAdapter, FactorResult } from "./types";
import type { ObservationInput } from "../types";
import { httpJson } from "./http";

const URL = "https://stablecoins.llama.fi/stablecoins?includePrices=false";

interface StablecoinsResp {
  peggedAssets: { symbol: string; name: string; circulating: { peggedUSD?: number } }[];
}

/**
 * Total stablecoin float (USD) plus the two largest by circulation. observed_at is
 * the floored slot (polled). One "stablecoin_float" observation per asset:
 * TOTAL + the top-N symbols.
 */
export const defillamaStablecoins: FactorAdapter = async (_cfg, ctx): Promise<FactorResult> => {
  try {
    const data = await httpJson<StablecoinsResp>(URL);
    const assets = data.peggedAssets ?? [];
    if (assets.length === 0) return { observations: [], errors: ["defillama: empty peggedAssets"] };

    const total = assets.reduce((s, a) => s + (a.circulating?.peggedUSD ?? 0), 0);
    const top = [...assets]
      .sort((a, b) => (b.circulating?.peggedUSD ?? 0) - (a.circulating?.peggedUSD ?? 0))
      .slice(0, 2);

    const base = { stream: "stablecoin_float", source: "defillama", instrument: "", unit: "usd", observedAt: ctx.slot };
    const observations: ObservationInput[] = [
      { ...base, asset: "TOTAL", value: total, metadata: { count: assets.length } },
      ...top.map((a) => ({ ...base, asset: a.symbol, value: a.circulating?.peggedUSD ?? 0, metadata: { name: a.name } })),
    ];
    return { observations, errors: [] };
  } catch (e) {
    return { observations: [], errors: [`defillama: ${(e as Error).message}`] };
  }
};
