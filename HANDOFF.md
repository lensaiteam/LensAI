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
- `0269723` deepening: pure mapper seams for factor adapters + fixture tests
- `433d5a3` deepening: DAL read-filter + claims (getClaims) + DB-hardening tests
- `66f6e95` CI: typecheck + invariant/guardrail suites on Node 24 (.github/workflows/ci.yml)

**Tests:** 88 green across 11 files (immutability, point-in-time, dedupe/revisions,
DAL filters + FK + WAL + reopen, hash, normalize, sources, adapters + pure mappers,
scheduler, guardrails). Typecheck clean. CI runs it all on Node 24.

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

## Deploy kit — DONE (Phase 1 "running on a box")

`deploy/` + `scripts/restore-check.ts`: systemd unit (Restart=always), env on the
box (FRED_API_KEY never in repo), backup (litestream OR cron snapshot shipped
off-machine), RESTORE test (rehearsed locally: integrity ok, 5 sources, 6 streams),
health via `tail`. Full walkthrough in `deploy/RUNBOOK.md`. **Phase 1 closes when
you run it on the VPS and rows land** (≥3 article sources, ≥4 factor streams).

## ⛔ PUSH BLOCKED — needs you (one command)

`git push` is rejected: the `lensaiteam` token lacks the `workflow` scope (needed
because `.github/workflows/ci.yml` is in the branch). Grant it, then I push + open
the PR:
```
! gh auth refresh -h github.com -u lensaiteam -s workflow
```
(Active gh account was `Predict-Protocol-Team`; I switched it to `lensaiteam`.)

## Phase 2 — COMPLETE (factor state store; approved amendments + sharpenings)

- **#1 Backfill before normalize** — `is_backfill` provenance (migration 0002 +
  DAL) + real-data backfill job (`npm run backfill`: Binance funding/OI, CoinGecko
  price/vol, FRED full series). Verified live: 1500 funding rows imported.
- **#2 Derived tables** — migration 0003 `factor_percentiles` + `factor_regimes`
  (rebuildable, NOT corpus, exempt from immutability triggers; every row stamps
  code/rule version + params + provenance). `src/lib/factors/derivedDal.ts`.
- **#3 as_of re-runnable** — normalizer reads through the as_of DAL; `{asOf, slot}`
  anchor any past instant (calibration-ready).
- **#4 Named windows + min-sample** — 90d/365d/full; below MIN_OBS=30 →
  `insufficient_history`, never a bare number.
- **#5 One clock + staleness** — canonical UTC hourly grid (`clock.ts`); each row
  carries staleness (T − state observed_at).
- **#6 Regime tags v1** — hand rules (`regimes.ts`): funding/oi (binance) +
  dollar (fred), elevated|neutral|suppressed / strong|neutral|weak, insufficient →
  unknown, one per asset via canonical source.
- **Sharpenings**: two clocks (window on observed_at, access on captured_at);
  vintage honesty (`true_pit` vs `current_vintage`); percentile carries
  (value, window_id, n_obs, vintage); fixed named windows.

Run: `npm run normalize`. Verified live on the dev corpus — funding_rate BTC/ETH/SOL
at 94th/83rd/100th pct (n=500, true_pit) → funding_regime elevated.

Tests: 123 green across ~18 files, Node 24 (`"/c/Program Files/nodejs/node.exe"
node_modules/vitest/vitest.mjs run`).

## Next (Phase 3 — DO NOT START without approval)

Mechanism graph: schema + seed format for hand-curated transmission channels
(content is human work). Per the strict build sequence, await approval.

## Git rules (user)

No `Co-Authored-By: Claude` trailer. Before any push, verify the active GitHub
account is **lensaiteam** (`gh auth status`; remote = github.com/lensaiteam/LensAI).
