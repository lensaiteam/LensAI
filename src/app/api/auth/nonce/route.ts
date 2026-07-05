import { NextRequest, NextResponse } from "next/server";
import { issueNonce } from "@/lib/auth/siwe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/auth/nonce -> { nonce }
export async function POST(req: NextRequest) {
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
