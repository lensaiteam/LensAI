"""LensAI tool: get_mechanism (auto-generated from the LensAI tool registry — do not edit)."""
import os
import json
import httpx


def get_mechanism(node: str = None, channel: str = None, asOf: float = None) -> dict:
    """Documented transmission channels from the curated mechanism graph (point-in-time): directed edges with polarity, mechanism rationale, lifecycle, and a curated-prior strength. Filter by node or channel."""
    base = os.environ["LENSAI_TOOLS_URL"].rstrip("/")
    token = os.environ.get("SERA_TOOLS_TOKEN", "")
    arguments = {k: v for k, v in {"node": node, "channel": channel, "asOf": asOf}.items() if v is not None}
    payload = {"jsonrpc": "2.0", "id": 1, "method": "tools/call",
               "params": {"name": "get_mechanism", "arguments": arguments}}
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
