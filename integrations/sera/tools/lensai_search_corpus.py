"""LensAI tool: search_corpus (auto-generated from the LensAI tool registry — do not edit)."""
import os
import json
import httpx


def search_corpus(asset: str = None, query: str = None, since: float = None, asOf: float = None, limit: float = None) -> dict:
    """Search the immutable point-in-time article corpus by asset/keyword; returns title, url, source, publish time and content hash (provenance). Never returns rows captured after the anchor."""
    base = os.environ["LENSAI_TOOLS_URL"].rstrip("/")
    token = os.environ.get("SERA_TOOLS_TOKEN", "")
    arguments = {k: v for k, v in {"asset": asset, "query": query, "since": since, "asOf": asOf, "limit": limit}.items() if v is not None}
    payload = {"jsonrpc": "2.0", "id": 1, "method": "tools/call",
               "params": {"name": "search_corpus", "arguments": arguments}}
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
