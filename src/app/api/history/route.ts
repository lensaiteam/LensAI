import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/history -> the wallet's analysis sessions (newest first)
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await supabaseAdmin()
    .from("analysis_sessions")
    .select("id, ticker, created_at")
    .eq("wallet_address", auth.walletAddress)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: "Failed to load history" }, { status: 500 });
  return NextResponse.json({ sessions: data ?? [] });
}
