# HANDOFF — capture layer

Branch: **`phase1-capture`** (off `main`). Nothing pushed. Read `CLAUDE.md` first.

## Phase 1 — COMPLETE ✅ (DoD met)

One command lands real rows from **5 article sources + 6 factor streams** into an
append-only, point-in-time SQLite corpus; tests pass; README documents run +
backup. All five invariants are encoded in code AND tests.

**Commits (on `phase1-capture`):**
- `a6807c1` scaffold (vitest, deps, docs, config)
- `a0c0462` DB layer — schema, immutability triggers, WAL client, migration runner
- `ba7f91b` hashing, normalization, source registry
- `0dd1d54` point-in-time DAL (dedupe + revisions)
- `4d01cfa` adapters (RSS + Binance/Bybit/CoinGecko/DefiLlama/FRED + stubs)
- `8f672e3` scheduler + ingest_runs bookkeeping + logger
- `c8ba232` guardrails (non-advisory filter INV3, claim-verifier stub INV4)
- `a44075e` scripts (migrate/capture/tail/backup) + README

**Tests:** 68 green across 9 files (immutability, point-in-time, dedupe/revisions,
hash, normalize, sources, adapters, scheduler, guardrails). Typecheck clean.

**Live DoD run:** `capture --once` → 249 rows (CoinDesk 25, Cointelegraph 30, The
Block 20, Blockworks 50, The Defiant 100; Binance funding/OI/depth, Bybit
funding/OI, CoinGecko spot price+volume, DefiLlama stablecoin float). FRED errored
correctly (no key) — recorded in `ingest_runs`, never faked. 2nd run wrote 0
(idempotent). Backup snapshot verified.

## ⚠️ Environment (unchanged — see also memory + CLAUDE.md)

Multiple Node installs: git-bash `node` = v24 (correct); `npx`/`cmd` default to a
stray v20; corrupt `node` shim at `C:\Users\yash\node_modules\.bin`. `better-sqlite3`
segfaults under v20. Run tools under v24:
```
NODE='/c/Program Files/nodejs/node.exe'
"$NODE" node_modules/vitest/vitest.mjs run
"$NODE" node_modules/tsx/dist/cli.mjs scripts/capture.ts --once
```
User cleanup: fix the home-dir `node_modules`/`package.json`, make Node 24 the
cmd/nvm default → then plain `npm test` / `npm run capture` work.

Minor: vitest occasionally prints "Failed to terminate worker" on teardown (native
addon in a fork) — cosmetic, tests still pass; re-run is clean.

## Next: Phase 2 (DO NOT START without approval)

Per the strict build sequence, Phase 2 is the **factor state store**: percentile
normalization of each stream against its OWN history, regime tags, one clock. It
reads the corpus via the point-in-time DAL (extend it with the "value visible at
as_of / latest captured_at <= as_of per slot" resolver already unit-tested).
No UI, LLM, SERA, or extraction work until each phase is approved.

Optional Phase 1 deepening if asked: add `FRED_API_KEY` and confirm macro rows;
per-instrument article intervals in config; more adapter unit tests; a CI workflow
pinned to Node 24.

## Git rules (user)

No `Co-Authored-By: Claude` trailer. Before any push, verify the active GitHub
account is **lensaiteam** (`gh auth status`; remote = github.com/lensaiteam/LensAI).
