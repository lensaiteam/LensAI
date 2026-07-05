import "server-only";
import { supabaseAdmin } from "./supabase";

/**
 * Upsert the users row on login (CLAUDE.md §5.1). Identity IS the wallet
 * address (stored lowercased) — no email, no PII.
 */
export async function upsertUserOnLogin(walletAddress: string, chainId: number): Promise<void> {
  const wallet = walletAddress.toLowerCase();
  const db = supabaseAdmin();
  const now = new Date().toISOString();

  const { data: existing } = await db
    .from("users")
    .select("wallet_address")
    .eq("wallet_address", wallet)
    .maybeSingle();

  if (existing) {
    await db.from("users").update({ last_login_at: now, chain_id: chainId }).eq("wallet_address", wallet);
  } else {
    await db.from("users").insert({ wallet_address: wallet, chain_id: chainId, last_login_at: now });
  }
}
