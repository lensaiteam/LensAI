import "server-only";
import { getProvider } from "./provider";
import { splitTrailer, inferSignal } from "./trailer";
import {
  ANALYSIS_SYSTEM_PROMPT,
  buildMarketBlock,
  buildNewsBlock,
  buildAnalysisInstruction,
} from "./prompts";
import { SHORT_DISCLAIMER } from "./disclaimer";
import { env } from "../env";
import type {
  Analysis,
  MarketData,
  NewsDigest,
  NewsItem,
  RiskFlag,
  SentimentField,
  Signal,
  TokenomicsField,
} from "../types";

export interface AnalysisResult {
  analysis: Analysis;
  sentiment: SentimentField;
  tokenomics: TokenomicsField;
  riskFlags: RiskFlag[];
  news: NewsItem[];
  model: string;
  inputTokens: number;
  outputTokens: number;
  webSearches: number;
}

export interface StreamAnalysisOpts {
  ticker: string;
  marketData: MarketData;
  /** Pre-fetched news for popular tokens; when present, web search is disabled. */
  newsDigest?: NewsDigest | null;
  /** Override the model (e.g. Haiku for the free tier). */
  model?: string;
}

/**
 * Run the analysis as a stream. Every text delta is passed to `onText` so the
 * route can forward it to the browser. Resolves with the full parsed result
 * once the model finishes. One model call produces both the streamed prose and
 * the structured trailer (spec §4.5 / §5.4) — no second call.
 */
export async function streamAnalysis(
  opts: StreamAnalysisOpts,
  onText: (delta: string) => void,
): Promise<AnalysisResult> {
  const model = opts.model ?? env.analysisModel();
  const hasNews = Boolean(opts.newsDigest && opts.newsDigest.items.length > 0);

  const contextBlock =
    buildMarketBlock(opts.marketData) + (hasNews ? "\n\n" + buildNewsBlock(opts.newsDigest!) : "");

  // Provider-neutral: the selected adapter handles streaming, prompt caching,
  // and web search / grounding. Long-tail tokens search the web; popular tokens
  // with pre-fetched news do not (§4.3).
  const provider = getProvider();
  const result = await provider.streamMessage(
    {
      model,
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: `${contextBlock}\n\n${buildAnalysisInstruction(opts.ticker, hasNews)}` },
      ],
      maxTokens: 2000, // §4.5 output cap
      webSearch: !hasNews,
    },
    onText,
  );

  const { prose, trailer } = splitTrailer(result.text);
  const signal: Signal = trailer?.signal ?? inferSignal(prose);

  const analysis: Analysis = {
    ticker: opts.ticker.toUpperCase(),
    displayName: opts.marketData.name || opts.ticker.toUpperCase(),
    signal,
    markdown: prose,
    disclaimer: SHORT_DISCLAIMER,
    citations: trailer?.citations ?? [],
  };

  return {
    analysis,
    sentiment:
      trailer?.sentiment ?? { overall: signal, tone: "Not available", sources: [] },
    tokenomics:
      trailer?.tokenomics ?? {
        supplyModel: "unknown",
        concentration: "unknown",
        unlockRisk: "unknown",
        notes: "",
      },
    riskFlags: trailer?.risk_flags ?? [],
    news: trailer?.news ?? opts.newsDigest?.items ?? [],
    model: `${provider.name}/${model}`,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    webSearches: result.webSearches,
  };
}
