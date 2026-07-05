import "server-only";
import { supabaseAdmin } from "./supabase";

/**
 * Per-wallet fixed-window rate limiting (spec §13). Backed by the
 * rate_limits table so limits hold across serverless instances. Windows are
 * bucketed to the start of each `windowMs` slice.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: string;
}

export async function checkRateLimit(
  walletAddress: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs).toISOString();
  const db = supabaseAdmin();

  // Upsert-then-read: increment the counter for this (wallet, window).
  const { data: existing } = await db
    .from("rate_limits")
    .select("request_count")
    .eq("wallet_address", walletAddress)
    .eq("window_start", windowStart)
    .maybeSingle();

  const count = (existing?.request_count ?? 0) + 1;

  await db
    .from("rate_limits")
    .upsert(
      { wallet_address: walletAddress, window_start: windowStart, request_count: count },
      { onConflict: "wallet_address,window_start" },
    );

  const resetAt = new Date(Math.floor(now / windowMs) * windowMs + windowMs).toISOString();
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetAt };
}
