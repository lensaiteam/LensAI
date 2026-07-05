import "server-only";
import { supabaseAdmin } from "./supabase";
import type { UsageRecord } from "./types";

/**
 * Append a row to usage_log. This is how we validate real cost against the
 * §12 targets — always log cache_hit and web_searches. Best-effort: a logging
 * failure must never break the user-facing request.
 */
export async function logUsage(rec: UsageRecord): Promise<void> {
  try {
    await supabaseAdmin().from("usage_log").insert({
      session_id: rec.sessionId ?? null,
      wallet_address: rec.walletAddress ?? null,
      model: rec.model,
      input_tokens: rec.inputTokens,
      output_tokens: rec.outputTokens,
      web_searches: rec.webSearches,
      cache_hit: rec.cacheHit,
    });
  } catch (err) {
    console.error("[usage] failed to log usage", err);
  }
}
