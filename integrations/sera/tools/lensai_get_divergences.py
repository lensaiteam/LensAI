"""LensAI tool: get_divergences (auto-generated from the LensAI tool registry — do not edit)."""
import os
import json
import httpx


def get_divergences(asOf: float = None, kind: str = None, asset: str = None) -> dict:
    """Fired divergence flags at a point in time: historically extreme factor states, broken cross-factor relationships, and structural signatures — each with its input provenance."""
    base = os.environ["LENSAI_TOOLS_URL"].rstrip("/")
    token = os.environ.get("SERA_TOOLS_TOKEN", "")
    arguments = {k: v for k, v in {"asOf": asOf, "kind": kind, "asset": asset}.items() if v is not None}
    payload = {"jsonrpc": "2.0", "id": 1, "method": "tools/call",
               "params": {"name": "get_divergences", "arguments": arguments}}
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
