import type { DB } from "../capture/db/client";
import { TOOLS, toolByName } from "./registry";

/**
 * Minimal MCP-style JSON-RPC 2.0 dispatcher. Implements the subset an agent
 * router needs — `initialize`, `tools/list`, `tools/call` — so the tool layer is
 * transport-agnostic and fully testable in-process. (Swap in the official MCP SDK
 * later if strict compliance beyond this subset is required; the registry is the
 * stable surface.)
 */

export const SERVER_INFO = { name: "lensai-tools", version: "1.0.0" };
export const PROTOCOL_VERSION = "2024-11-05";

export interface RpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}
export interface RpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
}

function ok(id: RpcRequest["id"], result: unknown): RpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, result };
}
function err(id: RpcRequest["id"], code: number, message: string): RpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

/** MCP tool-call result wraps content; tool-level failures set isError (not a
 *  protocol error) so the router sees them as tool output. */
function toolResult(payload: unknown, isError = false): unknown {
  return { content: [{ type: "text", text: JSON.stringify(payload) }], isError };
}

export function handleRpc(db: DB, req: RpcRequest): RpcResponse {
  switch (req.method) {
    case "initialize":
      return ok(req.id, { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: SERVER_INFO });

    case "tools/list":
      return ok(req.id, { tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.jsonSchema })) });

    case "tools/call": {
      const name = req.params?.name as string | undefined;
      const args = (req.params?.arguments ?? {}) as Record<string, unknown>;
      if (!name) return err(req.id, -32602, "tools/call requires params.name");
      const tool = toolByName(name);
      if (!tool) return err(req.id, -32602, `unknown tool: ${name}`);
      const parsed = tool.input.safeParse(args);
      if (!parsed.success) {
        return ok(req.id, toolResult({ error: "invalid arguments", issues: parsed.error.issues }, true));
      }
      try {
        const out = tool.handler(db, parsed.data as Record<string, unknown>);
        return ok(req.id, toolResult(out));
      } catch (e) {
        return ok(req.id, toolResult({ error: (e as Error).message }, true));
      }
    }

    default:
      return err(req.id, -32601, `method not found: ${req.method}`);
  }
}
