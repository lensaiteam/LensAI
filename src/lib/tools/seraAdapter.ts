import { TOOLS, type ToolDef } from "./registry";

/**
 * SERA integration. SERA-CryptoAgent has NO MCP: tools are Python modules in
 * `sera/tools/`, selected by an embedding router over their DOCSTRINGS, with
 * typed function signatures introspected into schemas, and gated by env vars.
 *
 * So we generate one drop-in Python module per registry tool — a thin httpx
 * wrapper that calls our HTTP tool server's /rpc. The registry is the single
 * source of truth (names, descriptions, schemas), so regenerating keeps SERA in
 * sync. These files are dropped into a SERA checkout's `sera/tools/` (see
 * docs/SERA-INTEGRATION.md). We do not fork SERA.
 */

export interface GeneratedFile {
  path: string;
  content: string;
}

function pyType(schema: Record<string, unknown>): string {
  return schema.type === "number" ? "float" : "str";
}

function signature(tool: ToolDef): { params: string; argsDict: string } {
  const js = tool.jsonSchema as { properties?: Record<string, Record<string, unknown>>; required?: string[] };
  const props = js.properties ?? {};
  const required = new Set(js.required ?? []);
  const names = Object.keys(props);
  // Python requires non-default params before defaulted ones.
  const ordered = [...names.filter((n) => required.has(n)), ...names.filter((n) => !required.has(n))];
  const params = ordered
    .map((n) => (required.has(n) ? `${n}: ${pyType(props[n])}` : `${n}: ${pyType(props[n])} = None`))
    .join(", ");
  const entries = ordered.map((n) => `"${n}": ${n}`).join(", ");
  return { params, argsDict: `{${entries}}` };
}

function moduleFor(tool: ToolDef): string {
  const { params, argsDict } = signature(tool);
  // Docstring drives SERA's embedding router — mirror the registry description.
  return `"""LensAI tool: ${tool.name} (auto-generated from the LensAI tool registry — do not edit)."""
import os
import json
import httpx


def ${tool.name}(${params}) -> dict:
    """${tool.description}"""
    base = os.environ["LENSAI_TOOLS_URL"].rstrip("/")
    token = os.environ.get("SERA_TOOLS_TOKEN", "")
    arguments = {k: v for k, v in ${argsDict}.items() if v is not None}
    payload = {"jsonrpc": "2.0", "id": 1, "method": "tools/call",
               "params": {"name": "${tool.name}", "arguments": arguments}}
    resp = httpx.post(base + "/rpc", json=payload,
                      headers={"Authorization": f"Bearer {token}"}, timeout=20)
    resp.raise_for_status()
    data = resp.json()
    if data.get("error"):
        raise RuntimeError(f"lensai tool error: {data['error']}")
    result = data["result"]
    if result.get("isError"):
        raise RuntimeError(result["content"][0]["text"])
    return json.loads(result["content"][0]["text"])
`;
}

/** One Python module per tool, ready to drop into a SERA checkout's sera/tools/. */
export function generateSeraTools(): GeneratedFile[] {
  return TOOLS.map((t) => ({ path: `lensai_${t.name}.py`, content: moduleFor(t) }));
}
