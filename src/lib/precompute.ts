import "server-only";
import { getProvider } from "./ai/provider";
import {
  ANALYSIS_SYSTEM_PROMPT,
  buildMarketBlock,
  buildNewsBlock,
  buildAnalysisInstruction,
} from "./ai/prompts";
import { splitTrailer, inferSignal } from "./ai/trailer";
import { SHORT_DISCLAIMER } from "./ai/disclaimer";
import { gatherMarketData } from "./market";
import { prefetchNews, buildDigest } from "./news/digest";
import { writeCachedToken } from "./cache/tokenCache";
import { env } from "./env";
import type { Analysis, Signal } from "./types";

/**
 * Top tokens refreshed on a schedule (CLAUDE.md §4.2). Requests for these are
 * always cache hits; this cost is FIXED regardless of user count. Extend toward
 * ~200 as needed.
 */
export const TOP_TOKENS = [
  "BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "AVAX", "DOGE", "DOT", "LINK",
  "MATIC", "LTC", "SHIB", "UNI", "ATOM", "NEAR", "APT", "ARB", "OP", "SUI",
  "INJ", "TIA", "SEI", "PEPE", "BONK", "JUP", "WIF", "RNDR", "FIL", "AAVE",
];

/**
 * Pre-compute one token into token_cache. Popular tokens use PRE-FETCHED news
 * (§4.3), so no metered web search is attached. Model access goes through the
 * provider gateway, so this runs on whatever LLM_PROVIDER selects.
 *
 * Note: on Anthropic in production this loop is a candidate for the Batch API
 * (§4.4, 50% off) inside the Anthropic adapter; on the Gemini dev/free tier a
 * batch discount is moot, so we issue regular calls with a concurrency cap.
 */
async function precomputeOne(ticker: string): Promise<boolean> {
  try {
    const provider = getProvider();
    const marketData = await gatherMarketData(ticker);
    const news = await prefetchNews(ticker); // NewsDigest | null

    const contextBlock =
      buildMarketBlock(marketData) + (news ? "\n\n" + buildNewsBlock(news) : "");

    const result = await provider.streamMessage(
      {
        model: env.chatModel(),
        system: ANALYSIS_SYSTEM_PROMPT,
        messages: [
          { role: "user", content: `${contextBlock}\n\n${buildAnalysisInstruction(ticker, Boolean(news))}` },
        ],
        maxTokens: 2000,
        webSearch: false,
      },
      () => {},
    );

    const { prose, trailer } = splitTrailer(result.text);
    const signal: Signal = trailer?.signal ?? inferSignal(prose);

    const analysis: Analysis = {
      ticker,
      displayName: marketData.name || ticker,
      signal,
      markdown: prose,
      disclaimer: SHORT_DISCLAIMER,
      citations: trailer?.citations ?? [],
    };

    await writeCachedToken({
      ticker,
      analysis,
      marketData,
      newsDigest: news ?? buildDigest(trailer?.news ?? [], "none", 0),
      sentiment: trailer?.sentiment ?? { overall: signal, tone: "n/a", sources: [] },
      tokenomics:
        trailer?.tokenomics ?? { supplyModel: "unknown", concentration: "unknown", unlockRisk: "unknown", notes: "" },
      riskFlags: trailer?.risk_flags ?? [],
      model: `${provider.name}/${env.chatModel()}`,
      ttlMinutes: 60, // popular tokens refreshed hourly
    });
    return true;
  } catch (err) {
    console.error(`[precompute] ${ticker} failed`, err);
    return false;
  }
}

export interface PrecomputeResult {
  total: number;
  written: number;
  failed: number;
}

/**
 * Refresh a batch of tokens into token_cache with a bounded concurrency (keeps
 * us under free-tier rate limits). Never throws — per-token failures are counted.
 */
export async function runPrecompute(
  tokens: string[] = TOP_TOKENS,
  concurrency = 3,
): Promise<PrecomputeResult> {
  let written = 0;
  let failed = 0;
  let cursor = 0;

  const worker = async () => {
    // `cursor++` is atomic in JS's single-threaded model (no await between
    // read and increment), so workers never pick the same index.
    while (cursor < tokens.length) {
      const ticker = tokens[cursor++];
      (await precomputeOne(ticker)) ? written++ : failed++;
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tokens.length) }, worker),
  );
  return { total: tokens.length, written, failed };
}
