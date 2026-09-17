import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { signAgentToken, AGENT_TOKEN_TTL_SEC } from "@/lib/agent/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/agent/token -> a short-lived, audience-bound token for the agent
// service. The browser talks to the agent service directly (long answers stream
// over SSE, which a serverless function would time out on), but the httpOnly
// session cookie never leaves this origin — only this 15-minute token does.
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const token = await signAgentToken(auth.walletAddress, env.sessionSecret());
  return NextResponse.json({
    token,
    expiresInSec: AGENT_TOKEN_TTL_SEC,
    agentUrl: process.env.NEXT_PUBLIC_AGENT_URL ?? null,
  });
}
