import "server-only";
import { anthropic, WEB_SEARCH_TOOL } from "./anthropic";
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

  const client = anthropic();
  const stream = client.messages.stream({
    model,
    max_tokens: 2000, // §4.5 output cap
    system: [
      {
        type: "text",
        text: ANALYSIS_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" }, // shared across all analyses — biggest cache lever
      },
    ],
    // Only attach web search for the long tail (no pre-fetched news).
    ...(hasNews ? {} : { tools: [WEB_SEARCH_TOOL] }),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: contextBlock },
          { type: "text", text: buildAnalysisInstruction(opts.ticker, hasNews) },
        ],
      },
    ],
  });

  stream.on("text", (delta) => onText(delta));

  const final = await stream.finalMessage();

  // Collect the full assistant text across text blocks.
  const fullText = final.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");

  const { prose, trailer } = splitTrailer(fullText);
  const usage = final.usage;
  const webSearches =
    (usage as { server_tool_use?: { web_search_requests?: number } }).server_tool_use
      ?.web_search_requests ?? 0;

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
    model,
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    webSearches,
  };
}
