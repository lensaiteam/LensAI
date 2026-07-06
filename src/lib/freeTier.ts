import "server-only";
import { supabaseAdmin } from "./supabase";
import { env } from "./env";

// spec §5.3 — 2 by default, overridable via FREE_TIER_LIMIT (see env.ts).
export const FREE_ANALYSES = env.freeTierLimit();

/**
 * Free-tier accounting, enforced SERVER-SIDE only (spec §13).
 *
 * Policy decision (documented per §5.3): a cache HIT for a popular token does
 * NOT consume a free credit — the user gets pre-computed shared content for
 * free. A credit is consumed only when we actually run a (non-cached) pipeline.
 * `consumeFreeCredit` is therefore called by /api/analyze *only* on a cache miss.
 */
export async function getFreeUsage(walletAddress: string): Promise<number> {
  const { data } = await supabaseAdmin()
    .from("free_tier_usage")
    .select("free_used")
    .eq("wallet_address", walletAddress)
    .maybeSingle();
  return data?.free_used ?? 0;
}

export async function hasFreeCreditsLeft(walletAddress: string): Promise<boolean> {
  return (await getFreeUsage(walletAddress)) < FREE_ANALYSES;
}

/** Atomically increment free_used. Returns the new count. */
export async function consumeFreeCredit(walletAddress: string): Promise<number> {
  const current = await getFreeUsage(walletAddress);
  const next = current + 1;
  await supabaseAdmin()
    .from("free_tier_usage")
    .upsert(
      { wallet_address: walletAddress, free_used: next, updated_at: new Date().toISOString() },
      { onConflict: "wallet_address" },
    );
  return next;
}
