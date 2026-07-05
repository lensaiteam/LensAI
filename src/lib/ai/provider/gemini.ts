import "server-only";
import { GoogleGenAI } from "@google/genai";
import { env } from "../../env";
import type { LLMProvider, LLMRequest, LLMResult } from "./types";

/**
 * Google Gemini adapter (dev-oriented free tier). PHASE 1 STUB — the client is
 * wired and the shape is real, but generation is not implemented yet. Real
 * streaming + Google Search grounding land in the pipeline phases (§15 steps
 * 4/6/7), where analyze/chat/precompute are repointed to the gateway.
 */
let client: GoogleGenAI | null = null;

function gemini(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: env.geminiKey() });
  return client;
}

export function geminiProvider(): LLMProvider {
  return {
    name: "gemini",
    async streamMessage(_req: LLMRequest, _onText): Promise<LLMResult> {
      // Touch the client so mis-set credentials surface here, not at wiring time.
      void gemini;
      throw new Error(
        "Gemini provider not implemented yet (Phase 1 stub). Real generation is wired in the analyze/chat phases.",
      );
    },
  };
}
