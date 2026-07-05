import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { sessionOwnedBy, getMessages } from "@/lib/sessions";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/history/:id -> one session with its messages
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const owned = await sessionOwnedBy(params.id, auth.walletAddress);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const messages = await getMessages(params.id, 200);
  return NextResponse.json({ id: params.id, ticker: owned.ticker, messages });
}

// DELETE /api/history/:id -> delete one session (per-session history delete, §5.5)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const owned = await sessionOwnedBy(params.id, auth.walletAddress);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Messages cascade via the FK on delete.
  await supabaseAdmin().from("analysis_sessions").delete().eq("id", params.id);
  return NextResponse.json({ ok: true });
}
