# OPEN_QUESTIONS.md

Spec ambiguities and the reversible choice taken for each. Working rule: pick the
reversible option, log it here, move on. Resolved items stay for the record.

## Resolved

### Q1 — Storage engine: Postgres or SQLite?
**Resolved: SQLite (better-sqlite3) for Phase 1**, portable SQL + a migration
runner for a clean lift to Postgres. The repo only *uses* hosted Supabase via
PostgREST (no local Postgres, no `pg`, no runner), and the immutable corpus must
be decoupled from the web app's infra. Conditions applied: WAL mode +
`busy_timeout` (single writer now, concurrent readers later); off-machine backup
in the DoD; immutability triggers kept in **per-dialect** migration files so the
Postgres twin stays clean. *Reversible:* the schema is portable; a later phase can
lift to Postgres when the corpus outgrows one file or needs concurrent writers.

### Q2 — Dedupe scope: global or per-source?
**Resolved: per-source.** Cross-source syndication is signal — if CoinDesk and
Blockworks both carry the same wire story, both rows are kept. Dedupe key includes
`source`. (Articles: `UNIQUE(source, content_hash)`.)

### Q3 — Factor dedupe vs. revisions.
**Resolved: dedupe key is `UNIQUE(stream, source, asset, instrument, observed_at,
content_hash)`**, NOT without `content_hash`. Sources like FRED revise a value for
a past reference date; those revisions must append as new rows (same `observed_at`,
later `captured_at`, different `content_hash`) — capture never refuses data.
Identical re-fetches (same payload → same hash) still dedupe, preserving restart
idempotency. Phase 2 resolves "value visible at `as_of`" = latest
`captured_at <= as_of` for a given slot.

### Q4 — Corpus DB in production.
**Resolved: a separate, always-on host — never the web app's infra.** The daemon
expects an always-on machine; the corpus file is the moat and is backed up
off-machine. README states this.

### Q5 — Fail-soft must not be silent.
**Resolved.** The web app's `null`-return convention would let a feed fail quietly
for a week and leave a permanent corpus hole. In capture, every fetch failure
writes an `ingest_runs` row with `status=error`; `capture:tail` shows the last
successful run per source so gaps are visible at a glance.

### Q6 — Mechanism-graph seed format.
**Resolved: YAML via `js-yaml` (pinned 4.1.0)**, zod-validated. Prose fields
(mechanism/conditions) read far better in YAML than JSON.

### Q7 — Mechanism-graph versioning & mutability.
**Resolved: keep all versions; all graph tables (nodes/edges/evidence/versions)
are append-only** under the same immutability triggers as the corpus. The seed
file is the editable surface; a change is a new `graph_version`. Loads are
transactional. Same version id + different checksum = hard error; same content
checksum under a new version id = no-op + warning. Point-in-time =
`getGraph({asOf})` picks the latest version with `loaded_at <= asOf`.

### Q8 — Edge directionality.
**Resolved: directed edges only.** A two-way (↔) relationship is two directed
edges sharing a `channel`, each with its own polarity + mechanism.

### Q9 — Edge conditions.
**Resolved: keep `conditions` prose, PLUS optional `regimes_applies` /
`regimes_breaks` arrays** validated against Phase 2 regime keys — so Phase 4
never parses prose and needs no mid-phase migration.

### Q10 — Evidence references.
**Resolved: soft refs** (`type` ∈ article|claim|external, `ref` text). `graph:check
--resolve` verifies article/claim refs against the corpus as **warnings, not
failures** (external refs skipped).

### Q11 — Curation rules.
**Resolved: ids are permanent** (rename = add + deprecate, never reuse);
**`strength` is a curated prior** until the calibration record exists, and every
consumer must present it as such. Documented in the seed header + enforced by review.

### Q12 — Divergence engine (Phase 4) parameters & scope.
**Resolved:** extreme-state thresholds 0.95/0.05 on the **365d** window; co-movement
lookback 30d; all params stamped per row (`div-v1`). **Structural signatures are in
scope** (leverage_led/spot_led/fragile) as curated v1 rules over funding + OI
(depth not yet a normalized scalar, ETF flows stubbed — proxies, to sharpen later).
**Broken-relationship is graph-driven only** (no separate factor-pair seed) — one
source of truth; dormant in graph-v1 (no factor↔factor edges) and lights up as
curation adds them. Thin inputs ⇒ `indeterminate`, never a fabricated flag.

### Q13 — SERA integration transport.
**Resolved.** Verified from the repo: SERA has **no MCP**; tools are Python modules
in `sera/tools/`, router embeds docstrings, env-gated, httpx. So: a read-only
**HTTP JSON-RPC** tool server (MCP-style dispatcher, reusable) + **generated Python
drop-in modules** (`npm run sera:gen` → `integrations/sera/tools/`) that call it,
kept in sync with the registry. Bearer-token auth on HTTP (secure default: no token
⇒ denied); stdio is local-only. We add modules; we do not fork SERA (Apache-2.0,
NOTICE preserved). See `docs/SERA-INTEGRATION.md`.

### Q14 — Narration (Phase 6) design.
**Resolved.** Provider-swappable behind `LlmProvider` (only `generate.ts` imports
the Anthropic SDK); **Claude `claude-opus-5` default**, tests use MockProvider (no
key). The model returns **structured claims** (`{text, basis, refs, numbers}`), not
free prose, so labeling (measured/mechanical/conjecture) and numeric verification
are mechanical. Pipeline is **fail-closed**: malformed output rejected, unverified
numbers/advisory/fake-edge claims dropped (never softened), final `assertNonAdvisory`
on the assembled text. Emitted briefs are logged to an **append-only** calibration
record. Scope v1 = Market State + Token briefing (Incident mechanics is a follow-on).

### Q15 — Agent LLM: free-tier pool instead of a paid model.
**Decision (2026-09-17), reversible.** No paid tiers; pool free providers, **one
key each** (multi-account stacking is out — ToS). Consequence taken in the design:
no open tool loop (free models are unreliable at it) — plan → deterministic gather →
ONE structured generation → the existing fail-closed gates; everything that can be
arithmetic is (changes, watches, track record); generic reads are one shared brief
per anchor. Supersedes Q14's "Claude default" for the running system: `narrate` now
defaults to the pool, `--anthropic` remains an opt-in. **Reversal is a config edit**
(`config/llm-pool.json` takes any OpenAI-compatible endpoint, paid or free). Known
ceiling: pooled free limits cap concurrent ad-hoc questions; per-user daily budget
(`AGENT_DAILY_ASK_LIMIT`) + graceful degradation to the measured state absorb it.

### Q16 — INV-4 tightened: numbers in prose must be declared.
**Resolved.** A claim whose TEXT contains a number absent from its `numbers` array is
dropped (`undeclared-number`) — otherwise a weaker model could write "94th percentile"
in prose with `numbers: []` and bypass verification. Duration labels ("365-day",
"90d") are exempt. Applies to scheduled narration too (shared `auditClaims`).

### Q17 — Engine hosting: Railway single service vs VPS.
**Reversible; Railway kit added, VPS kit kept.** A Railway volume attaches to one
service, so capture + derive + agent API run as ONE process (`npm run serve`,
`Dockerfile`, `deploy/RAILWAY.md`) with litestream → R2 for off-box backup. The
systemd/VPS kit in `deploy/` still works unchanged. This does **not** force the
Postgres lift (Q: capture store) — that triggers only when a second service/host
needs the corpus. The Docker image is unverified locally (no Docker on the dev box).

### Q18 — Where agent user state lives.
**Resolved.** Supabase (`db/migrations/0002_agent.sql`), never the capture SQLite:
the corpus and `briefs` are append-only, so anything user-derived there could not be
erased. Hence question-specific answers are not persisted to `briefs`; only
user-agnostic shared briefs are. Migration **applied to the hosted project 2026-09-17**
and verified end to end (tables, both RPCs, tenancy, cascade on account deletion).

## Open

_None blocking. New ambiguities get appended here with the reversible choice taken._
