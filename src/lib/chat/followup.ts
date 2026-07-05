import "server-only";
import { anthropic } from "../ai/anthropic";
import { SHORT_DISCLAIMER } from "../ai/disclaimer";
import { env } from "../env";
import type { CachedToken } from "../types";

const CHAT_SYSTEM_PROMPT = `You are LensAI, answering follow-up questions about a crypto token the user just analyzed. Same NON-ADVISORY rules apply: never say buy/sell/hold, never give a price target or allocation, always frame things as signals and present both sides. Attribute web-derived claims. Be concise. If you don't have the data, say so rather than inventing it. End with: ${SHORT_DISCLAIMER}`;

export interface FollowupResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Fall-through Haiku follow-up (CLAUDE.md §5.4) for genuinely new questions the
 * stored fields can't answer. We re-send the already-gathered analysis + facts
 * as cached context (no new web search), and stream the reply.
 */
export async function streamFollowup(
  cached: CachedToken | null,
  ticker: string,
  history: { role: "user" | "assistant"; content: string }[],
  message: string,
  onText: (delta: string) => void,
): Promise<FollowupResult> {
  const model = env.chatModel();

  const context = cached
    ? `Analysis of ${ticker} (as of ${cached.generated_at}):\n\n${cached.analysis.markdown}\n\nStructured facts:\n${JSON.stringify(
        { market: cached.market_data, sentiment: cached.sentiment, tokenomics: cached.tokenomics, risk_flags: cached.risk_flags },
      )}`
    : `The user previously asked about ${ticker}, but the stored analysis has expired.`;

  const client = anthropic();
  const stream = client.messages.stream({
    model,
    max_tokens: 1000,
    system: [{ type: "text", text: CHAT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: context, cache_control: { type: "ephemeral" } },
        ],
      },
      { role: "assistant", content: "Understood — I have the analysis context. What's your question?" },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user" as const, content: message },
    ],
  });

  stream.on("text", (d) => onText(d));
  const final = await stream.finalMessage();
  const text = final.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");

  return {
    text,
    model,
    inputTokens: final.usage.input_tokens ?? 0,
    outputTokens: final.usage.output_tokens ?? 0,
  };
}
