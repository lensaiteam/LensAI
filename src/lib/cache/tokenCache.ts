import "server-only";
import { supabaseAdmin } from "../supabase";
import type {
  Analysis,
  CachedToken,
  MarketData,
  NewsDigest,
  RiskFlag,
  SentimentField,
  TokenomicsField,
} from "../types";

const DEFAULT_TTL_MIN = 30; // CLAUDE.md §4.1

/** Read a token's cached analysis. Returns null on miss or if expired. */
export async function getCachedToken(ticker: string): Promise<CachedToken | null> {
  const { data } = await supabaseAdmin()
    .from("token_cache")
    .select("*")
    .eq("ticker", ticker.toUpperCase())
    .maybeSingle();

  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;

  return {
    ticker: data.ticker,
    analysis: data.analysis as Analysis,
    market_data: data.market_data as MarketData,
    news_digest: data.news_digest as NewsDigest,
    sentiment: data.sentiment as SentimentField,
    tokenomics: data.tokenomics as TokenomicsField,
    risk_flags: (data.risk_flags ?? []) as RiskFlag[],
    model: data.model,
    generated_at: data.generated_at,
    expires_at: data.expires_at,
  };
}

/** Is the ticker currently a fresh cache hit? */
export async function isCacheHit(ticker: string): Promise<boolean> {
  return (await getCachedToken(ticker)) !== null;
}

export interface WriteCacheInput {
  ticker: string;
  analysis: Analysis;
  marketData: MarketData;
  newsDigest: NewsDigest;
  sentiment: SentimentField;
  tokenomics: TokenomicsField;
  riskFlags: RiskFlag[];
  model: string;
  ttlMinutes?: number;
}

/** Upsert the ticker's analysis + structured fields into token_cache. */
export async function writeCachedToken(input: WriteCacheInput): Promise<void> {
  const now = new Date();
  const expires = new Date(now.getTime() + (input.ttlMinutes ?? DEFAULT_TTL_MIN) * 60_000);

  await supabaseAdmin()
    .from("token_cache")
    .upsert(
      {
        ticker: input.ticker.toUpperCase(),
        analysis: input.analysis,
        market_data: input.marketData,
        news_digest: input.newsDigest,
        sentiment: input.sentiment,
        tokenomics: input.tokenomics,
        risk_flags: input.riskFlags,
        model: input.model,
        generated_at: now.toISOString(),
        expires_at: expires.toISOString(),
      },
      { onConflict: "ticker" },
    );
}
