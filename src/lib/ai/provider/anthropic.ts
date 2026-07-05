import "server-only";
import { anthropic, WEB_SEARCH_TOOL } from "../anthropic";
import type { LLMProvider, LLMRequest, LLMResult } from "./types";

/**
 * Anthropic adapter — the production swap-in. Kept real (it wraps the SDK we
 * already use) so switching providers is a genuine config change, and so the
 * gateway interface is validated against a second provider from day one.
 */
export function anthropicProvider(): LLMProvider {
  return {
    name: "anthropic",
    async streamMessage(req: LLMRequest, onText): Promise<LLMResult> {
      const stream = anthropic().messages.stream({
        model: req.model,
        max_tokens: req.maxTokens,
        system: [
          // Cache the (stable) system prompt — biggest cache lever (§13).
          { type: "text", text: req.system, cache_control: { type: "ephemeral" } },
        ],
        ...(req.webSearch ? { tools: [WEB_SEARCH_TOOL] } : {}),
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      });

      stream.on("text", (delta) => onText(delta));
      const final = await stream.finalMessage();

      const text = final.content
        .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
        .map((b) => b.text)
        .join("");

      const webSearches =
        (final.usage as { server_tool_use?: { web_search_requests?: number } }).server_tool_use
          ?.web_search_requests ?? 0;

      return {
        text,
        inputTokens: final.usage.input_tokens ?? 0,
        outputTokens: final.usage.output_tokens ?? 0,
        webSearches,
      };
    },
  };
}
