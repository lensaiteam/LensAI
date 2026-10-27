---
description: Extend the hands, not fork the brain. The same stores, for any agent.
---

# Tool layer and agent access

Everything the desk reads is also available as **tools**: read-only, point-in-time endpoints over the engine's stores. The desk's own agents use them, and so can outside agents and integrations.

## The tools

| Tool | Returns |
|---|---|
| Market state | The anchor, regimes, fired flags and structural signatures. |
| Token factor state | One asset's percentiles across windows and its regimes. |
| Factor series | The recent observations of one stream, for charting or checking. |
| Divergences | Fired flags, filterable by kind and asset. |
| Mechanism | The mechanism graph as of a given time. |
| Corpus search | Captured articles, with source, time and content hash. |
| Claims | Typed claims with claimant and role. |

Every tool takes an "as of" time, and nothing returned can postdate it.

## Access today

* **JSON-RPC** over HTTP and stdio, following the shape of the Model Context Protocol.
* **API keys** for integrations. Keys are stored only as hashes and reach the read and ask surface, never account management.
* **The ask endpoint**, as JSON or as a live event stream of stages, evidence blocks and the verified answer.

## Built on SERA

LensAI's base agent is **SERA-CryptoAgent** from Sentient, open source under the Apache-2.0 licence. LensAI extends its hands rather than forking its brain: its stores are wrapped as additional tools that SERA's router can select, and generated drop-in tool modules let SERA call the engine directly. SERA carries none of LensAI's guardrails; those are enforced in LensAI's own narration layer and verified on output. Attribution and notices are preserved as the licence requires.

## Next: a free, standard MCP server

Agents increasingly act on market data without checking it. A prompt hidden in a social post has already been used to make an AI-controlled wallet send funds, and data-API builders report agents acting on numeric fields with no sanity check. LensAI's answer is **verify before act**:

* a free, standard remote MCP server, listed in the official MCP registry and offered to agent platforms;
* Claim Check as a tool, so an agent can check a number before acting on it;
* instructions stripped from any quoted post before it is served;
* published uptime.

No local package will ever ask for a private key.
