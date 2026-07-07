/**
 * Shared types for the LensAI analysis pipeline.
 *
 * The "signal" is the non-advisory core (CLAUDE.md §6): we assess whether
 * current signals look POSITIVE / MIXED / NEGATIVE — never buy/sell.
 */

export type Signal = "POSITIVE" | "MIXED" | "NEGATIVE";

/** Raw market snapshot gathered from Coinbase (+ CoinGecko fallback). */
export interface MarketData {
  name: string;
  symbol: string;
  price: number | null;
  priceDisplay: string;
  change24hPct: number | null;
  change7dPct: number | null;
  volume24h: number | null;
  marketCap: number | null;
  circulatingSupply: number | null;
  totalSupply: number | null;
  maxSupply: number | null;
  rank: number | null;
  /** ~30 daily closes, oldest→newest, for a price sparkline (Coinbase only). */
  sparkline: number[] | null;
  source: "coinbase" | "coingecko" | "coinbase+coingecko";
  /** True when neither source could resolve the ticker. */
  unresolved: boolean;
  asOf: string; // ISO timestamp
}

export interface NewsItem {
  title: string;
  source: string;
  url: string;
  publishedAt?: string;
  summary?: string;
}

export interface NewsDigest {
  items: NewsItem[];
  gatheredVia: "prefetched" | "web_search" | "none";
  webSearchCount: number;
  asOf: string;
}

/** Structured fields persisted to token_cache for cheap follow-ups (§5.4). */
export interface SentimentField {
  overall: Signal;
  tone: string;
  sources: string[];
}

export interface TokenomicsField {
  supplyModel: string;
  concentration: string;
  unlockRisk: string;
  notes: string;
}

export interface RiskFlag {
  level: "green" | "yellow" | "red";
  label: string;
}

/**
 * The final analysis. `markdown` holds the streamed 6-section prose (§6);
 * the queryable structured fields for cheap follow-ups (§5.4) live alongside
 * on CachedToken (sentiment / tokenomics / risk_flags / news_digest), not baked
 * into the prose.
 */
export interface Analysis {
  ticker: string;
  displayName: string;
  signal: Signal;
  markdown: string;
  disclaimer: string;
  citations: { label: string; url: string }[];
}

/** The machine-readable trailer the model appends after the prose. */
export interface AnalysisTrailer {
  signal: Signal;
  sentiment: SentimentField;
  tokenomics: TokenomicsField;
  risk_flags: RiskFlag[];
  news: NewsItem[];
  citations: { label: string; url: string }[];
}

/** Everything written to token_cache for one ticker. */
export interface CachedToken {
  ticker: string;
  analysis: Analysis;
  market_data: MarketData;
  news_digest: NewsDigest;
  sentiment: SentimentField;
  tokenomics: TokenomicsField;
  risk_flags: RiskFlag[];
  model: string;
  generated_at: string;
  expires_at: string;
}

export interface AuthUser {
  walletAddress: string; // lowercased
  chainId: number;
}

export interface UsageRecord {
  sessionId?: string | null;
  walletAddress?: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  webSearches: number;
  cacheHit: boolean;
}
