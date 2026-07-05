import "server-only";
import { GoogleGenAI } from "@google/genai";
import { env } from "../../env";
import type { LLMProvider, LLMRequest, LLMResult } from "./types";

/**
 * Google Gemini adapter (dev-oriented free tier). Maps the provider-neutral
 * request onto Gemini's generateContentStream:
 *   - system prompt  -> config.systemInstruction
 *   - messages       -> contents (assistant -> "model")
 *   - webSearch      -> Google Search grounding tool
 * Thinking is disabled (thinkingBudget: 0) so the whole maxTokens budget goes to
 * the answer — 2.5-flash otherwise spends output tokens on hidden reasoning and
 * can truncate the structured analysis.
 */
let client: GoogleGenAI | null = null;

function gemini(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: env.geminiKey() });
  return client;
}

export function geminiProvider(): LLMProvider {
  return {
    name: "gemini",
    async streamMessage(req: LLMRequest, onText): Promise<LLMResult> {
      const contents = req.messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const stream = await gemini().models.generateContentStream({
        model: req.model,
        contents,
        config: {
          systemInstruction: req.system,
          maxOutputTokens: req.maxTokens,
          thinkingConfig: { thinkingBudget: 0 },
          ...(req.webSearch ? { tools: [{ googleSearch: {} }] } : {}),
        },
      });

      let text = "";
      let inputTokens = 0;
      let outputTokens = 0;
      const searchQueries = new Set<string>();

      for await (const chunk of stream) {
        const t = chunk.text;
        if (t) {
          text += t;
          onText(t);
        }
        const um = chunk.usageMetadata;
        if (um) {
          inputTokens = um.promptTokenCount ?? inputTokens;
          outputTokens = um.candidatesTokenCount ?? outputTokens;
        }
        const queries = chunk.candidates?.[0]?.groundingMetadata?.webSearchQueries;
        if (queries) for (const q of queries) searchQueries.add(q);
      }

      return { text, inputTokens, outputTokens, webSearches: searchQueries.size };
    },
  };
}
