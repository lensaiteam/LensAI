# The LensAI agent

The research desk as something a user can **ask**, **leave watching**, and **hand
a claim to**. It is a layer over the Phase 1–6 engine: it adds no new market
truth, only ways to reach the truth the engine already computed.

## Shape: plan → gather → one generation → gates

The agent does **not** run an open tool-calling loop. Free models are unreliable
at that, and the engine doesn't need it:

```
question ─▶ plan ─▶ gather (point-in-time tool layer) ─▶ ONE structured generation
                                                              │
        render ◀─ non-advisory guardrail ◀─ claim gates ◀─────┘
```

- **Plan** (`plan.ts`) — regex heuristics answer the common shapes with zero model
  calls; only ambiguous questions spend one small-model call. Pool exhausted → the
  heuristic guess is used.
- **Gather** — the same `gatherMarket/Token/Incident` as scheduled narration.
- **Generate** — structured claims (`measured` / `mechanical` / `conjecture`).
- **Gates** (`narrate/orchestrator.ts: auditClaims`) — every number resolves to a
  store row (including numbers that appear only in prose), a mechanical claim
  cites a real graph edge, nothing reads as advice. A failing claim is dropped; if
  nothing survives, the agent retries once on a **different** provider, then falls
  back to the measured state. It never guesses and never errors at the user.

## Free-pool economics

Ruling: free tiers only, **one key per provider**, never multiple accounts.

| Request | Model calls |
|---|---|
| Generic read ("market state", "brief on SOL") | 0 — the shared per-anchor brief, generated once per hour for everyone |
| "What changed since I last looked?" | 0 — arithmetic between two anchors |
| Track record | 0 — read from `briefs` |
| Watch evaluation (any number of watches) | 0 — arithmetic on derived tables |
| Specific question | 1 small (plan, often skipped) + 1 strong |
| Watch creation | 1 small, once |
| Claim check | 1 strong |

`config/llm-pool.json` is the pool; `llm/router.ts` picks the provider with the
most rpm/rpd headroom, cools down on 429, fails over on error. `npm run llm:eval`
admits models on fixed cases through the real code paths. Each user has a daily
model budget (`AGENT_DAILY_ASK_LIMIT`); past it the agent still serves everything
in the zero-call rows above.

## Watches

Plain language → rule DSL (`watch/rule.ts`) via one call → deterministic echo the
user confirms → stored. From then on a watch is arithmetic: evaluated once per
anchor, **edge-triggered** (false→true), cooldown-bounded, fail-closed on missing
data. Alerts carry the measured evidence and pass the non-advisory filter. A rule
can only describe a state, never an instruction; price-level alerts are refused.

## Claim check

The model only **extracts and maps** (claim → store ref / graph edge). The verdict
is arithmetic: `supported` (±1%), `contradicted` (store value shown), or
`unverifiable` (the desk doesn't measure it). Causal claims are `documented` only
if they map to a real mechanism edge. Trade instructions in the pasted text are
reported, never echoed.

## User data

Lives in Supabase (`db/migrations/0002_agent.sql`), cascades from `users`, so
account deletion erases all of it. Export: `GET /v1/export`. Erase: `DELETE /v1/account`.

| Stored | Why |
|---|---|
| wallet address (SIWE) | identity — no name, password, KYC |
| email / Telegram chat id | only if that alert channel is turned on |
| conversations (scrubbed text, as_of, claim audit) | history; auto-purged after 90 idle days |
| watches + trigger log | the feature |
| watchlist (symbols only), timezone, last-seen anchor | personalisation, "what changed" |
| daily usage counters | the free pool is finite |
| API key **hashes** | tool endpoint; the key is shown once |
| claim-check submissions (scrubbed) | only when the user chooses `save` |
| answer feedback | calibration |

Never stored: private keys or signing permissions, balances or on-chain activity
(the address is never enriched), exchange keys, payment data, IP addresses
(per-minute limiting is in-memory), ad trackers.

### Three boundaries (each enforced in code and tests)

1. **No user identifier reaches a model.** User text is scrubbed
   (`privacy.ts: scrubIdentifiers`), and the router refuses any prompt containing a
   wallet, an email, or that user's known identifiers (`assertPromptClean`).
2. **User data never enters the append-only corpus or `briefs`.** Shared briefs are
   keyed by market state; question-specific answers are never persisted there.
3. **Session cookie never leaves the web origin.** The browser gets a 15-minute,
   audience-bound agent token from `GET /api/agent/token`.

## HTTP surface (`api.ts`, served by `scripts/serve.ts`)

Session token or API key: `POST /v1/ask` (JSON, or SSE stages with
`Accept: text/event-stream`), `GET /v1/changes`, `POST /v1/claim-check`,
`GET /v1/usage`, `POST /rpc` (the MCP-style tool endpoint).

Session only: conversations, watches (`/compile` → confirm → create), prefs,
Telegram link, API keys, feedback, export, account deletion.

`GET /health` is public and reports the latest anchor and pool status.

## Not built here

The web UI for the agent. The frontend direction is still being settled in the
design playground; the agent is a complete API the UI can be built against.
