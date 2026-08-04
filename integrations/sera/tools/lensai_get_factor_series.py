"""LensAI tool: get_factor_series (auto-generated from the LensAI tool registry — do not edit)."""
import os
import json
import httpx


def get_factor_series(stream: str, asset: str, source: str = None, asOf: float = None, limit: float = None) -> dict:
    """Point-in-time history of one factor series (observed_at, value), latest revision known at the anchor. Use for trend/context, not percentiles."""
    base = os.environ["LENSAI_TOOLS_URL"].rstrip("/")
    token = os.environ.get("SERA_TOOLS_TOKEN", "")
    arguments = {k: v for k, v in {"stream": stream, "asset": asset, "source": source, "asOf": asOf, "limit": limit}.items() if v is not None}
    payload = {"jsonrpc": "2.0", "id": 1, "method": "tools/call",
               "params": {"name": "get_factor_series", "arguments": arguments}}
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
