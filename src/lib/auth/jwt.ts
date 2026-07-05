import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../env";
import type { AuthUser } from "../types";

const ALG = "HS256";
const ISSUER = "lensai";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

function secret(): Uint8Array {
  return new TextEncoder().encode(env.sessionSecret());
}

/** Mint the session JWT set in the httpOnly cookie after SIWE verification. */
export async function signSession(user: AuthUser): Promise<string> {
  return new SignJWT({ wallet_address: user.walletAddress, chain_id: user.chainId })
    .setProtectedHeader({ alg: ALG })
    .setIssuer(ISSUER)
    .setSubject(user.walletAddress)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
    .sign(secret());
}

export async function verifySession(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: ISSUER });
    const walletAddress = String(payload.wallet_address ?? "").toLowerCase();
    const chainId = Number(payload.chain_id ?? 1);
    if (!walletAddress) return null;
    return { walletAddress, chainId };
  } catch {
    return null;
  }
}
