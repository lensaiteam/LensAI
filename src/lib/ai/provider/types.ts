import "server-only";

/**
 * Provider-neutral LLM gateway (CLAUDE.md model-agnostic principle; see the
 * provider-swap override in the project instructions). Every model call in the
 * app goes through this interface — the concrete provider is chosen once, by
 * env, in ./index.ts. No provider/model name may appear outside this module.
 *
 * The interface abstracts the two things that differ across providers and that
 * the pipeline depends on: token STREAMING and optional WEB SEARCH (Anthropic's
 * `web_search` tool ↔ Gemini's Google Search grounding). Per-provider niceties
 * like prompt caching stay inside each adapter.
 */

export type LLMRole = "user" | "assistant";

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export interface LLMRequest {
  /** Concrete model id for this provider (from ANALYSIS_MODEL / CHAT_MODEL). */
  model: string;
  /** System prompt (adapters may attach provider-specific cache hints). */
  system: string;
  messages: LLMMessage[];
  maxTokens: number;
  /** Enable the provider's web search / grounding for the long tail. */
  webSearch?: boolean;
}

export interface LLMResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  /** Number of web searches/grounding queries the model performed. */
  webSearches: number;
}

export interface LLMProvider {
  /** Stable provider id, e.g. "gemini" | "anthropic" (for logging/usage_log). */
  readonly name: string;
  /**
   * Generate a message, streaming text deltas to `onText`, and resolve with the
   * full text plus usage once complete.
   */
  streamMessage(req: LLMRequest, onText: (delta: string) => void): Promise<LLMResult>;
}
