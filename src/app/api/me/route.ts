import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getFreeUsage, FREE_ANALYSES } from "@/lib/freeTier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/me -> current user + free-tier status (null user if not signed in)
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ user: null });

  const freeUsed = await getFreeUsage(user.walletAddress);
  return NextResponse.json({
    user,
    freeTier: { used: freeUsed, limit: FREE_ANALYSES, remaining: Math.max(0, FREE_ANALYSES - freeUsed) },
  });
}
