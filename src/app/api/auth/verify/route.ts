import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifySiwe } from "@/lib/auth/siwe";
import { setSessionCookie } from "@/lib/auth/session";
import { upsertUserOnLogin } from "@/lib/users";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  message: z.string().min(1),
  signature: z.string().min(1),
});

// POST /api/auth/verify -> verify SIWE, set session cookie
export async function POST(req: NextRequest) {
  if (!env.dbConfigured()) {
    return NextResponse.json(
      { error: "LensAI backend isn't configured yet. Add Supabase credentials to .env.local (see README)." },
      { status: 503 },
    );
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = await verifySiwe(parsed.data.message, parsed.data.signature);
  if (!result.ok || !result.walletAddress || !result.chainId) {
    return NextResponse.json({ error: result.error ?? "Verification failed" }, { status: 401 });
  }

  await upsertUserOnLogin(result.walletAddress, result.chainId);

  const res = NextResponse.json({
    ok: true,
    user: { walletAddress: result.walletAddress, chainId: result.chainId },
  });
  await setSessionCookie(res, { walletAddress: result.walletAddress, chainId: result.chainId });
  return res;
}
