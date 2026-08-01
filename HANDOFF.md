# HANDOFF — Phase 1 (capture layer)

Working state for the next session. Branch: **`phase1-capture`** (off `main`).
Nothing pushed. Read `CLAUDE.md` first, then this.

## Done so far

- **Orientation:** v2 spec read; codebase mapped; SERA repos confirmed **Apache-2.0**
  (SERA-CryptoAgent, ROMA, Sentient-Agent-Framework) — recorded in CLAUDE.md.
- **CLAUDE.md** rewritten for v2; v1 spec archived to `docs/CLAUDE-v1.md`.
- **Commit 1 (`a6807c1`)** — scaffold: vitest, deps (better-sqlite3, rss-parser),
  npm scripts, `.env.example` capture section, `KEYS_NEEDED.md`, `OPEN_QUESTIONS.md`.
- **Commit 2 (`a0c0462`)** — DB layer: per-dialect migrations (SQLite live +
  Postgres twin), append-only schema (articles / factor_observations / claims +
  ingest_runs), immutability triggers, WAL client, migration runner, and
  `tests/db/immutability.test.ts` (5 tests, **green**). Typecheck clean.

## ⚠️ Environment gotcha (cost real time — fix first next session)

This machine has **multiple Node installs**: git-bash `node` = **v24.18.0** (correct),
but `npx`/`cmd`/`npm`-spawned tools default to a stray **v20.19.2**, AND there's a
**corrupt `node` shim at `C:\Users\yash\node_modules\.bin\node`** (a package.json +
node_modules living in the home dir) that npm puts on PATH ahead of the real node.

`better-sqlite3` is a native addon built for Node 24 → it **segfaults** under v20.
So `npm test` / `npx vitest` / `npm run capture` are currently unreliable.

**Reliable commands (bypass the shims, force Node 24):**
```
NODE='/c/Program Files/nodejs/node.exe'
"$NODE" node_modules/vitest/vitest.mjs run          # tests
"$NODE" node_modules/typescript/bin/tsc --noEmit    # typecheck
"$NODE" node_modules/tsx/dist/cli.mjs scripts/x.ts  # run a script under v24
```
**Permanent fix (user action):** clean up `C:\Users\yash\node_modules` / the home
package.json, and make Node 24 the default in cmd/nvm-windows. Once `node` is v24
everywhere, plain `npm test` / `npm run capture` work.

## Next, in order (Phase 1 remaining)

1. **hash + normalize + types + sources loader** (+ tests): `src/lib/capture/{hash,
   normalize,types}.ts`, `config/sources.json` + `sources.ts` (zod). Tests:
   hash determinism/dedupe, normalization idempotence, config validation.
2. **DAL** `src/lib/capture/db/dal.ts` — `insertArticle`/`insertObservation`/
   `insertClaim` (ON CONFLICT DO NOTHING → `{inserted}`), and **as_of-gated reads
   only** (every read requires `asOf`, injects `captured_at <= asOf`). Tests:
   `pointInTime.test.ts` (future rows invisible, boundary included), revision test
   (same observed_at + different value → both land; same value → deduped).
3. **Adapters** `src/lib/capture/adapters/*` + registry: rss, binance (funding/OI/
   depth), bybit (funding/OI), coingecko (spot px/vol), defillama (stablecoin float),
   fred (DXY `DTWEXBGS` + `DGS10`), stubs (ETF/institutional → throw NotImplemented).
   Test: rss fixture → Article[].
4. **Scheduler + logger** `src/lib/capture/{scheduler,logger}.ts` — idempotent (slot
   dedupe via observed_at), restart-safe (reads last ingest_runs), **every failure
   writes an ingest_runs error row** (fail-soft ≠ silent). Test: re-run same slot →
   0 new rows.
5. **Guardrails** `src/lib/guardrails/{outputFilter,verifier}.ts` — INV3 non-advisory
   filter + red-team test (runs in CI now); INV4 ClaimVerifier interface + stub.
6. **Scripts + README + backup**: `scripts/{capture,migrate,tail,backup}.ts`;
   README with setup + the **backup job** (litestream if `LITESTREAM_REPLICA_URL`
   else scheduled `sqlite3 .backup` to `CAPTURE_BACKUP_DIR`, copied off-machine) —
   part of the DoD.

## Definition of done (from the spec)

`migrate` then `capture --once` lands real rows from **≥3 article sources + ≥4
factor streams**; `capture:tail` shows them + last-success-per-source; tests pass;
README documents run + backup. Do NOT build Phases 2–6 (factor store, mechanism
graph, divergence, SERA, narration) or any UI/LLM calls.

## Approved amendments to honor (from the user)

WAL + busy_timeout ✅ done. Immutability triggers per-dialect ✅ done. Factor key
includes content_hash ✅ done. Per-source dedupe ✅. Still to apply: **non-silent
fail-soft** (ingest_runs error rows + tail last-success), **backup job in DoD**,
docs notes (polled observed_at = floored slot; pin the HTML-extraction dep since a
version bump changes hashes; DTWEXBGS = lagging free DXY proxy).

## Git rules (user)

No `Co-Authored-By: Claude` trailer. Before any push, verify the active GitHub
account is **lensaiteam** (`gh auth status`; remote = github.com/lensaiteam/LensAI).
