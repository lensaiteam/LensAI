import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { UserStore } from "./store/types";

/**
 * Agent-service authentication. Two credentials:
 *   - a SHORT-LIVED agent token the web app mints for a signed-in (SIWE) wallet —
 *     HS256 over the shared SESSION_JWT_SECRET, audience-bound so a long-lived
 *     session cookie is never itself accepted here;
 *   - a user API key (`lak_…`) for programmatic/agent access. Only its SHA-256 is
 *     stored; the key is shown once.
 * Identity is always the lowercased wallet address.
 */

export const AGENT_ISSUER = "lensai";
export const AGENT_AUDIENCE = "lensai-agent";
export const AGENT_TOKEN_TTL_SEC = 15 * 60;

const enc = (secret: string) => new TextEncoder().encode(secret);

export async function signAgentToken(wallet: string, secret: string, ttlSec: number = AGENT_TOKEN_TTL_SEC): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(AGENT_ISSUER)
    .setAudience(AGENT_AUDIENCE)
    .setSubject(wallet.toLowerCase())
    .setIssuedAt()
    .setExpirationTime(`${ttlSec}s`)
    .sign(enc(secret));
}

export async function verifyAgentToken(token: string, secret: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, enc(secret), { issuer: AGENT_ISSUER, audience: AGENT_AUDIENCE, algorithms: ["HS256"] });
    const wallet = String(payload.sub ?? "").toLowerCase();
    return /^0x[a-f0-9]{40}$/.test(wallet) ? wallet : null;
  } catch {
    return null;
  }
}

const KEY_PREFIX = "lak_";
export const hashApiKey = (key: string): string => createHash("sha256").update(key).digest("hex");

export function newApiKey(): { key: string; hash: string; prefix: string } {
  const key = KEY_PREFIX + randomBytes(24).toString("base64url");
  return { key, hash: hashApiKey(key), prefix: key.slice(0, 8) };
}

export interface Principal {
  wallet: string;
  via: "session" | "api_key";
}

export async function authenticate(authHeader: string | undefined, deps: { secret: string; store: UserStore }): Promise<Principal | null> {
  const m = authHeader?.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const cred = m[1].trim();
  if (cred.startsWith(KEY_PREFIX)) {
    const rec = await deps.store.findApiKeyByHash(hashApiKey(cred));
    return rec ? { wallet: rec.wallet, via: "api_key" } : null;
  }
  const wallet = await verifyAgentToken(cred, deps.secret);
  return wallet ? { wallet, via: "session" } : null;
}
