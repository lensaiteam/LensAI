import { NextResponse } from "next/server";
import { requireUser, clearSessionCookie } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE /api/account -> full account deletion (§10). Cascades to sessions,
// messages, watchlist, free_tier_usage, rate_limits; usage_log de-links.
export async function DELETE() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { error } = await supabaseAdmin().rpc("delete_account", { target_wallet: auth.walletAddress });
  // `app.delete_account` lives in the `app` schema; if rpc routing to `app` isn't
  // configured, fall back to a direct delete on the users table (same cascade).
  if (error) {
    await supabaseAdmin().from("users").delete().eq("wallet_address", auth.walletAddress);
  }

  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
