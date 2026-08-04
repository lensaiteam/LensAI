import { timingSafeEqual } from "node:crypto";
import { captureConfig } from "../capture/config";

/**
 * Bearer-token gate for the networked (HTTP) tool transport. Secure default: if no
 * SERA_TOOLS_TOKEN is configured, HTTP access is DENIED (stdio is local-only and
 * ungated). Constant-time comparison.
 */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function checkBearer(authHeader: string | undefined): boolean {
  const token = captureConfig.seraToolsToken();
  if (!token) return false; // no token set -> deny
  if (!authHeader) return false;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return !!m && safeEqual(m[1], token);
}
