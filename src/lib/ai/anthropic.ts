import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env";

let client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: env.anthropicKey() });
  }
  return client;
}

// Universally-supported web search tool version (works on Haiku 4.5 + Sonnet 4.6).
// CLAUDE.md caps searches at 4 per analysis; 1–2 preferred.
export const WEB_SEARCH_TOOL = {
  type: "web_search_20250305" as const,
  name: "web_search" as const,
  max_uses: 4,
};
export const MAX_WEB_SEARCHES = WEB_SEARCH_TOOL.max_uses;

// Sentinel that separates the streamed prose from the machine-readable trailer.
// The client stops rendering at this marker; the server parses the JSON after it.
export const TRAILER_SENTINEL = "<<<LENSAI_DATA>>>";
