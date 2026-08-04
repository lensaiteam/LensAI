"""LensAI tool: get_market_state (auto-generated from the LensAI tool registry — do not edit)."""
import os
import json
import httpx


def get_market_state(asOf: float = None) -> dict:
    """Whole-market structural read as of a point in time: factor regimes, fired structural signatures (spot-led vs leverage-led, fragile), and divergence flags. Non-advisory — describes structure, not what to do."""
    base = os.environ["LENSAI_TOOLS_URL"].rstrip("/")
    token = os.environ.get("SERA_TOOLS_TOKEN", "")
    arguments = {k: v for k, v in {"asOf": asOf}.items() if v is not None}
    payload = {"jsonrpc": "2.0", "id": 1, "method": "tools/call",
               "params": {"name": "get_market_state", "arguments": arguments}}
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
