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

## Open

_None blocking Phase 1. New ambiguities get appended here with the reversible
choice taken._
