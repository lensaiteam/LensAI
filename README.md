# LensAI

AI-powered, **non-advisory** crypto token analysis. Enter a ticker → get a decision-grade read
(POSITIVE / MIXED / NEGATIVE) synthesized from live market data + current news, then ask follow-ups
in the same thread. Auth is wallet sign-in (SIWE) — no email, no password, no private keys.

> LensAI provides information and analysis, **not financial advice**. It never says buy/sell.
> The full v2 product spec is [`lensai-research-desk-spec.md`](./lensai-research-desk-spec.md).

## Stack

- **Next.js 14** (App Router) · TypeScript · TailwindCSS
- **wagmi + viem + RainbowKit** for wallet connect; **SIWE (EIP-4361)** for the ownership proof
- **Supabase (Postgres)** as datastore only — access via **service-role, server-side** (Path B, §9)
- **LLM provider is swappable** (`src/lib/ai/provider`) — selected by `LLM_PROVIDER` (`gemini` or
  `anthropic`). No provider/model name appears outside the provider module; switching is a config
  change, not a refactor.
- **Coinbase** (price/volume/24h/7d) + **CoinGecko** fallback (market cap / supply / resolution)

## Architecture (the cost-minimizing core, §4)

1. **Per-ticker cache** (`token_cache`, 30-min TTL) — first requester runs the pipeline; everyone
   else is served from cache with an "as of" timestamp.
2. **Top-token precompute** with **pre-fetched news** — fixed cost regardless of user count. Runs
   through the provider gateway with a concurrency cap. See `/api/cron/precompute` +
   `scripts/precompute.ts`.
3. **Structured fields**, not just prose — `sentiment / tokenomics / risk_flags / news_digest` are
   stored so follow-ups resolve **without a model call or web search** (§5.4).
4. **Free tier**: 2 free analyses/wallet, enforced server-side; cache hits don't consume a credit.
5. **Web search / grounding** only for the long tail — Anthropic caps at 4/analysis; Gemini uses
   Google Search grounding (reports its query count).

```
src/
├── lib/            env · supabase · auth (siwe/jwt/session) · market · ai · cache · news · chat · precompute
├── app/
│   ├── page.tsx            landing
│   ├── app/page.tsx        research terminal (streaming analysis + chat + history)
│   └── api/                auth/* · me · analyze · chat · history · account · cron/precompute
└── components/     AuthProvider · Markdown · DisclaimerBanner · FirstLoginModal
db/migrations/0001_init.sql   schema + RLS backstop + app.delete_account()
design-reference/             the original static HTML prototype, kept as the visual source of truth
```

## Setup

1. **Install**
   ```bash
   npm install
   ```
2. **Env** — copy and fill:
   ```bash
   cp .env.example .env.local
   ```
   Required to run the live pipeline: `LLM_PROVIDER` + its key (`GEMINI_API_KEY` for the default
   `gemini`, or `ANTHROPIC_API_KEY` for `anthropic`), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `SESSION_JWT_SECRET` (random 32+ bytes), `APP_DOMAIN` (must match the browser host, e.g.
   `localhost:3000`), `CRON_SECRET`. CoinGecko/Coinbase work keyless. `NEXT_PUBLIC_WALLETCONNECT_ID`
   enables WalletConnect (MetaMask works without it). Auth/sign-in only needs Supabase + session
   vars; the LLM key is only needed to *generate* an analysis.
3. **Database** — run `db/migrations/0001_init.sql` against your Supabase project
   (SQL editor, or `psql "$SUPABASE_DB_URL" -f db/migrations/0001_init.sql`).
4. **Dev**
   ```bash
   npm run dev        # http://localhost:3000
   npm run typecheck  # tsc --noEmit
   ```

## Auth model (Path B, §9)

Login is SIWE, not Supabase Auth. Nonce → wallet signs a SIWE message → server verifies signature +
domain + chainId + single-use nonce → issues a JWT in an httpOnly cookie. All DB access uses the
service-role key from server route handlers, with wallet scoping enforced in application code; RLS in
the migration is a defence-in-depth backstop.

## Background precompute

With a server running:
```bash
# refresh the default top-token list:
CRON_SECRET=... APP_URL=http://localhost:3000 npm run precompute
# or a specific subset:
CRON_SECRET=... APP_URL=http://localhost:3000 npm run precompute -- BTC ETH SOL
```
In production, schedule this every 30–60 min (e.g. Vercel Cron) against `/api/cron/precompute`
(`POST` with `Authorization: Bearer $CRON_SECRET`).

## API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/nonce` | POST | Single-use, expiring SIWE nonce |
| `/api/auth/verify` | POST | Verify SIWE signature, set session cookie |
| `/api/auth/logout` | POST | Clear session |
| `/api/me` | GET | Current user + free-tier status |
| `/api/analyze` | POST | `{ ticker }` → cache check → gather → **streamed** analysis |
| `/api/chat` | POST | `{ sessionId, message }` → stored-field answer or streamed model follow-up |
| `/api/history` · `/api/history/:id` | GET/DELETE | List / open / delete sessions |
| `/api/account` | DELETE | Delete account (`app.delete_account`) |
| `/api/cron/precompute` | POST | Batch top-token refresh (Bearer `CRON_SECRET`) |

## Notes

- **Non-advisory guardrails** live in the system prompt (`src/lib/ai/prompts.ts`) — the model returns
  6 sections + a POSITIVE/MIXED/NEGATIVE signal and never says buy/sell.
- **Provider & models** are env-configurable (`LLM_PROVIDER`, `ANALYSIS_MODEL`, `CHAT_MODEL`) behind
  `src/lib/ai/provider` — no provider/model name appears elsewhere. Dev default: Gemini Flash.
- `usage_log` records tokens, web searches, and `cache_hit` so you can validate real cost against §12.

---

# Capture layer (v2 Research Desk — Phase 1)

The v2 rebuild starts with **capture**: an append-only, point-in-time corpus of
articles + factor observations. It is a **separate subsystem from the web app** —
it does NOT touch Supabase; the corpus is a local **SQLite** file (`better-sqlite3`,
WAL) that is the moat. See [`lensai-research-desk-spec.md`](./lensai-research-desk-spec.md) for the architecture and the
five invariants.

```
config/sources.json              source registry (RSS feeds + factor providers) — add a source with DATA only
db/capture/migrations/           per-dialect schema + immutability triggers (sqlite live, postgres twin)
src/lib/capture/                 config · db (client/migrate/dal/runs) · normalize · hash · adapters · scheduler
src/lib/guardrails/              non-advisory output filter (INV3) + claim-verifier stub (INV4)
scripts/                         migrate · capture · tail · backup
```

## ⚠️ Node 24 required

`better-sqlite3` is a native addon built for **Node 24**. This dev machine also has
a stray Node 20 that `npx`/`cmd` default to (plus a stale `node` shim in a
user-level `node_modules/.bin`), which **segfaults** the addon. Until that's
cleaned up, run the tools under Node 24 explicitly:

```bash
NODE='/c/Program Files/nodejs/node.exe'   # the v24 binary
"$NODE" node_modules/tsx/dist/cli.mjs scripts/migrate.ts
"$NODE" node_modules/vitest/vitest.mjs run        # tests
```

Once `node` is v24 everywhere, the plain `npm run …` scripts below work directly.

## Setup

1. `npm install` (installs `better-sqlite3`, `rss-parser`, `vitest`).
2. Optional keys in `.env.local` (capture works mostly keyless):
   - `FRED_API_KEY` — macro (DXY proxy `DTWEXBGS`, 10y `DGS10`). Free:
     <https://fred.stlouisfed.org/docs/api/api_key.html>. Without it, the macro jobs
     record an `ingest_runs` **error** (visible in `capture:tail`) rather than a
     silent gap — they never fabricate data.
   - `CAPTURE_DB_PATH` (default `./data/capture.db`), `CAPTURE_TICK_MS` (default 15000).
   - Backup: `LITESTREAM_REPLICA_URL` **or** `CAPTURE_BACKUP_DIR` (see below).

## Run

```bash
npm run migrate          # apply the SQLite schema + immutability triggers
npm run capture -- --once   # one pass over every source, then exit
npm run capture          # run forever (CAPTURE_TICK_MS); Ctrl-C to stop
npm run capture:tail     # corpus counts + last-success-per-source + recent runs
npm test                 # 68 tests (immutability, point-in-time, dedupe/revisions, adapters, scheduler, guardrails)
```

A fresh `capture -- --once` lands real rows from **5 article sources** (CoinDesk,
Cointelegraph, The Block, Blockworks, The Defiant) and **6 factor streams**
(funding rate, open interest, ±1%/±2% depth, spot price, spot volume, stablecoin
float). Re-running within a slot is a **no-op** (idempotent + restart-safe: state
lives in `ingest_runs`). `capture:tail` is how you watch rows land and spot gaps.

## Backup (the corpus is a single point of failure)

The daemon expects an **always-on host**, and one SQLite file on one disk is a SPOF.
Configure one of:

- **litestream** (preferred, continuous): set `LITESTREAM_REPLICA_URL` (e.g.
  `s3://bucket/capture`) and run litestream as a sidecar process replicating
  `CAPTURE_DB_PATH`.
- **snapshot fallback**: set `CAPTURE_BACKUP_DIR` and run `npm run backup` on a
  schedule (cron). It writes a WAL-consistent `.backup` copy; **copy it OFF the
  machine** (object storage / another host).

## Invariants (enforced in code + tests)

1. **Immutable capture** — content-hashed; `published_at`/`observed_at` separate from
   `captured_at`; UPDATE/DELETE rejected by DB triggers; corrections/revisions are new rows.
2. **Point-in-time** — every DAL read requires `as_of` and filters `captured_at <= as_of`.
3. **Non-advisory** — `src/lib/guardrails/outputFilter.ts` + red-team suite (runs in CI now).
4. **Numeric traceability** — `ClaimVerifier` interface + fail-closed stub (implemented Phase 6).
5. **Typed claims** — `claims` table (claimant / incentive / claimed_at / text / mechanism_refs); schema only.
