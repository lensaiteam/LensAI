# SERA integration (Phase 5)

How LensAI's stores plug into **SERA-CryptoAgent** as tools its embedding router can
select. "Extend its hands, not fork its brain."

## SERA's tool interface (verified from the repo, 2026-08)
- **No MCP.** SERA has no Model Context Protocol support.
- Tools are **Python modules in `sera/tools/`**, discovered by import.
- The router embeds each tool's **docstring** (top-k, cosine ≥ `rag_threshold`,
  `rag_top_k=15`) and introspects the **typed function signature** into an
  OpenAI-strict schema.
- Tools are **env-gated** (`@requires_env` in `_common.py`) and are **httpx** API
  wrappers. No plugin/registry/config format — adding a tool = adding a module.
- License: Apache-2.0 (preserve NOTICE; we add modules, we don't fork).

## Our approach
1. **LensAI HTTP tool server** (this repo): `npm run tools -- --http 8787`.
   Read-only, point-in-time, JSON-RPC at `POST /rpc`, bearer `SERA_TOOLS_TOKEN`,
   `GET /health`. Single source of truth = `src/lib/tools/registry.ts`.
2. **Generated Python drop-ins**: `npm run sera:gen` emits one
   `integrations/sera/tools/lensai_<tool>.py` per registry tool — a thin httpx
   wrapper (typed signature + docstring mirroring the registry) that calls `/rpc`.
   Regenerate to keep SERA in sync with the registry.

## Install into a SERA checkout
```bash
# 1. run the LensAI tool server on the capture host
SERA_TOOLS_TOKEN=<secret> npm run tools -- --http 8787

# 2. drop the generated modules into SERA
cp integrations/sera/tools/lensai_*.py <sera>/sera/tools/

# 3. point SERA at the server (its environment)
export LENSAI_TOOLS_URL=http://<capture-host>:8787
export SERA_TOOLS_TOKEN=<secret>
```
SERA imports the modules, embeds their docstrings, and routes matching queries to
them. Optionally add SERA's `@requires_env("LENSAI_TOOLS_URL")` above each function
(import from `._common`) so SERA filters them out when the URL is unset — adjust to
your SERA version.

## Verify
```bash
curl -s -XPOST http://localhost:8787/rpc -H "Authorization: Bearer $SERA_TOOLS_TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq '.result.tools[].name'
```
Then in SERA, a market-structure query should route to `get_market_state` /
`get_divergences` / `get_mechanism`.

## Tools exposed
`get_market_state`, `get_token_factor_state`, `get_divergences`, `get_mechanism`,
`get_factor_series`, `search_corpus`, `get_claims` — all read-only, point-in-time,
non-advisory, each result stamped with its `as_of` + provenance/vintage.
