import { NextRequest, NextResponse } from "next/server";
import { issueNonce } from "@/lib/auth/siwe";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOT_CONFIGURED =
  "LensAI backend isn't configured yet. Add Supabase credentials (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) to .env.local and restart. See README.";

// POST /api/auth/nonce -> { nonce }
export async function POST(req: NextRequest) {
  if (!env.dbConfigured()) {
    return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const walletHint = typeof body.address === "string" ? body.address : undefined;
    const nonce = await issueNonce(walletHint);
    return NextResponse.json({ nonce });
  } catch (err) {
    console.error("[auth/nonce]", err);
    return NextResponse.json({ error: "Failed to issue nonce" }, { status: 500 });
  }
}
