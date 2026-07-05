import "server-only";
import { SiweMessage } from "siwe";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "../supabase";
import { env } from "../env";

/**
 * SIWE (EIP-4361) ownership-proof flow (spec §5.1).
 *   1. issueNonce()  -> single-use, expiring nonce stored in auth_nonces
 *   2. client builds a SIWE message with that nonce and asks the wallet to sign
 *   3. verifySiwe() -> validates signature + domain + chainId + nonce, one-shot
 *
 * We never store the raw signature long-term: verify, then discard.
 */

export async function issueNonce(walletHint?: string): Promise<string> {
  // siwe requires an alphanumeric nonce >= 8 chars.
  const nonce = randomBytes(16).toString("hex");
  await supabaseAdmin().from("auth_nonces").insert({
    nonce,
    wallet_hint: walletHint?.toLowerCase() ?? null,
  });
  return nonce;
}

export interface VerifyResult {
  ok: boolean;
  walletAddress?: string;
  chainId?: number;
  error?: string;
}

export async function verifySiwe(message: string, signature: string): Promise<VerifyResult> {
  let siwe: SiweMessage;
  try {
    siwe = new SiweMessage(message);
  } catch {
    return { ok: false, error: "Malformed SIWE message" };
  }

  const db = supabaseAdmin();

  // Nonce must exist, be unused, and unexpired. Consume it atomically first so a
  // replayed message can't be verified twice even under a race.
  const { data: row } = await db
    .from("auth_nonces")
    .select("nonce, used, expires_at")
    .eq("nonce", siwe.nonce)
    .maybeSingle();

  if (!row) return { ok: false, error: "Unknown nonce" };
  if (row.used) return { ok: false, error: "Nonce already used" };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Nonce expired" };
  }

  // Mark used up front (single-use guarantee).
  await db.from("auth_nonces").update({ used: true }).eq("nonce", siwe.nonce);

  // Verify signature + domain + nonce. `domain` must equal APP_DOMAIN.
  try {
    const result = await siwe.verify({
      signature,
      domain: env.appDomain(),
      nonce: siwe.nonce,
    });
    if (!result.success) {
      return { ok: false, error: "Signature verification failed" };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Verification error" };
  }

  return {
    ok: true,
    walletAddress: siwe.address.toLowerCase(),
    chainId: siwe.chainId,
  };
}
