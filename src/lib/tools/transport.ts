import type { DB } from "../capture/db/client";
import { handleRpc } from "./rpc";
import { checkBearer } from "./auth";

/**
 * Transport-agnostic wrappers around the RPC dispatcher, kept pure/testable.
 * - stdio: newline-delimited JSON-RPC (one request per line) — for a local
 *   subprocess router.
 * - HTTP: POST a JSON-RPC body with a Bearer token.
 */

/** Process one stdio JSONL line -> a response line (or null for blank/garbage). */
export function handleStdioLine(db: DB, line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  let req: unknown;
  try {
    req = JSON.parse(trimmed);
  } catch {
    return JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } });
  }
  return JSON.stringify(handleRpc(db, req as Parameters<typeof handleRpc>[1]));
}

export interface HttpResult {
  status: number;
  body: unknown;
}

/** Handle an HTTP JSON-RPC call: bearer auth -> parse -> dispatch. */
export function handleHttpRpc(db: DB, authHeader: string | undefined, rawBody: string): HttpResult {
  if (!checkBearer(authHeader)) return { status: 401, body: { error: "unauthorized" } };
  let req: unknown;
  try {
    req = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } } };
  }
  return { status: 200, body: handleRpc(db, req as Parameters<typeof handleRpc>[1]) };
}
