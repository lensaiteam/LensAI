import { NextResponse } from "next/server";
import { requireUser, clearSessionCookie } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE /api/account -> full account deletion (§10).
//
// Deleting the users row triggers the schema's FK cascades: analysis_sessions ->
// messages, watchlist, free_tier_usage, rate_limits are removed; usage_log
// de-links (wallet_address set null) so aggregate cost accounting survives.
//
// NOTE: we delete the users row directly rather than calling app.delete_account.
// Supabase's REST layer (PostgREST) only exposes the `public` schema, so the
// `app`-schema function isn't callable over the API — and the direct delete
// produces the exact same cascade.
export async function DELETE() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { error } = await supabaseAdmin().from("users").delete().eq("wallet_address", auth.walletAddress);
  if (error) {
    console.error("[account] delete failed", error);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
