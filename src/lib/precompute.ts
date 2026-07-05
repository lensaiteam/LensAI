import "server-only";
import { anthropic } from "./ai/anthropic";
import {
  ANALYSIS_SYSTEM_PROMPT,
  buildMarketBlock,
  buildNewsBlock,
  buildAnalysisInstruction,
} from "./ai/prompts";
import { SHORT_DISCLAIMER } from "./ai/disclaimer";
import { splitTrailer } from "./ai/analyze";
import { gatherMarketData } from "./market";
import { prefetchNews, buildDigest } from "./news/digest";
import { writeCachedToken } from "./cache/tokenCache";
import { env } from "./env";
import type { Analysis, Signal } from "./types";

/**
 * Top tokens refreshed on a schedule (spec §4.2). Requests for these are
 * always cache hits; this cost is FIXED regardless of user count. Extend toward
 * ~200 as needed. Kept as symbols the market layer can resolve.
 */
export const TOP_TOKENS = [
  "BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "AVAX", "DOGE", "DOT", "LINK",
  "MATIC", "LTC", "SHIB", "UNI", "ATOM", "NEAR", "APT", "ARB", "OP", "SUI",
  "INJ", "TIA", "SEI", "PEPE", "BONK", "JUP", "WIF", "RNDR", "FIL", "AAVE",
];

/**
 * Submit a Batch of Haiku analyses for the top tokens (§4.4 — 50% off, non-
 * interactive). Popular tokens use PRE-FETCHED news, so no metered web search
 * is attached (§4.3). Returns the batch id to collect later.
 */
export async function submitPrecomputeBatch(tokens: string[] = TOP_TOKENS): Promise<string> {
  const model = env.chatModel(); // Haiku for the background job

  const requests = await Promise.all(
    tokens.map(async (ticker) => {
      const marketData = await gatherMarketData(ticker);
      const news = await prefetchNews(ticker);
      const contextBlock =
        buildMarketBlock(marketData) + (news ? "\n\n" + buildNewsBlock(news) : "");
      return {
        custom_id: ticker.toUpperCase(),
        params: {
          model,
          max_tokens: 2000,
          system: [{ type: "text" as const, text: ANALYSIS_SYSTEM_PROMPT }],
          messages: [
            {
              role: "user" as const,
              content: [
                { type: "text" as const, text: contextBlock },
                { type: "text" as const, text: buildAnalysisInstruction(ticker, Boolean(news)) },
              ],
            },
          ],
        },
      };
    }),
  );

  const batch = await anthropic().messages.batches.create({ requests });
  return batch.id;
}

/** Poll a batch; when ended, parse each result and write it to token_cache. */
export async function collectPrecomputeBatch(batchId: string): Promise<{
  status: string;
  written: number;
}> {
  const client = anthropic();
  const batch = await client.messages.batches.retrieve(batchId);
  if (batch.processing_status !== "ended") {
    return { status: batch.processing_status, written: 0 };
  }

  let written = 0;
  for await (const entry of await client.messages.batches.results(batchId)) {
    if (entry.result.type !== "succeeded") continue;
    const ticker = entry.custom_id;
    const msg = entry.result.message;
    const fullText = msg.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("");
    const { prose, trailer } = splitTrailer(fullText);
    const signal: Signal = trailer?.signal ?? "MIXED";

    // Re-gather market/news for the structured fields (stateless collect).
    const marketData = await gatherMarketData(ticker);
    const news = (await prefetchNews(ticker)) ?? buildDigest(trailer?.news ?? [], "prefetched", 0);

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
      newsDigest: news,
      sentiment: trailer?.sentiment ?? { overall: signal, tone: "n/a", sources: [] },
      tokenomics:
        trailer?.tokenomics ?? { supplyModel: "unknown", concentration: "unknown", unlockRisk: "unknown", notes: "" },
      riskFlags: trailer?.risk_flags ?? [],
      model: env.chatModel(),
      ttlMinutes: 60, // popular tokens refreshed hourly
    });
    written++;
  }

  return { status: "ended", written };
}
