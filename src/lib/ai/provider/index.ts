import "server-only";
import { env } from "../../env";
import type { LLMProvider } from "./types";
import { geminiProvider } from "./gemini";
import { anthropicProvider } from "./anthropic";

export type { LLMProvider, LLMRequest, LLMResult, LLMMessage, LLMRole } from "./types";

/**
 * The ONLY place a provider is selected. Reads LLM_PROVIDER and returns the
 * matching adapter. Switching providers is a config change, not a refactor.
 */
export function getProvider(): LLMProvider {
  const provider = env.llmProvider();
  switch (provider) {
    case "gemini":
      return geminiProvider();
    case "anthropic":
      return anthropicProvider();
    default:
      throw new Error(
        `Unknown LLM_PROVIDER "${provider}". Supported: "gemini", "anthropic".`,
      );
  }
}
