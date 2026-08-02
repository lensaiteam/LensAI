import type { ArticleAdapter, FactorAdapter } from "./types";
import { rssAdapter } from "./rss";
import { binanceFunding, binanceOpenInterest, binanceDepth } from "./binance";
import { bybitFunding, bybitOpenInterest } from "./bybit";
import { coingeckoSpot } from "./coingecko";
import { defillamaStablecoins } from "./defillama";
import { fred } from "./fred";

export * from "./types";

/** Factor adapters keyed by the config `adapter` field. Adding a source of an
 *  EXISTING type is config-only; a new provider type adds one entry here. */
export const factorAdapters: Record<string, FactorAdapter> = {
  binanceFunding,
  binanceOpenInterest,
  binanceDepth,
  bybitFunding,
  bybitOpenInterest,
  coingeckoSpot,
  defillamaStablecoins,
  fred,
};

/** Article adapters keyed by the config `type` field. */
export const articleAdapters: Record<string, ArticleAdapter> = {
  rss: rssAdapter,
};

export function getFactorAdapter(name: string): FactorAdapter | undefined {
  return factorAdapters[name];
}
export function getArticleAdapter(type: string): ArticleAdapter | undefined {
  return articleAdapters[type];
}
