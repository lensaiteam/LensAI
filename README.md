# LensAI

AI-powered, **non-advisory** crypto token analysis. Enter a ticker → get a decision-grade read
(POSITIVE / MIXED / NEGATIVE) synthesized from live market data + current news, then ask follow-ups
in the same thread. Auth is wallet sign-in (SIWE) — no email, no password, no private keys.

> LensAI provides information and analysis, **not financial advice**. It never says buy/sell.
> See the spec for the full product spec — it is the source of truth.

## Stack

- **Next.js 14** (App Router) · TypeScript · TailwindCSS
- **wagmi + viem + RainbowKit** for wallet connect; **SIWE (EIP-4361)** for the ownership proof
- **Supabase (Postgres)** as datastore only — access via **service-role, server-side** (Path B, §9)
- **LLM provider is swappable** (`src/lib/ai/provider`) — selected by `LLM_PROVIDER`. Dev default is
  **Google Gemini Flash** (free tier, $0 dev); **Anthropic Claude** (Sonnet 4.6 / Haiku 4.5) is the
  production swap-in. No provider/model name appears outside the provider module.

  > Gemini's free tier is rate-limited and dev-oriented. For production, set `LLM_PROVIDER=anthropic`
  > (or another adapter) — a config change, not a refactor.
- **Coinbase** (price/volume/24h/7d) + **CoinGecko** fallback (market cap / supply / resolution)

## Architecture (the cost-minimizing core, §4)

1. **Per-ticker cache** (`token_cache`, 30-min TTL) — first requester runs the pipeline; everyone
   else is served for ~$0 with an "as of" timestamp.
2. **Top-token precompute** with **pre-fetched news** — fixed cost regardless of user count. Runs
   through the provider gateway with a concurrency cap. See `/api/cron/precompute` +
   `scripts/precompute.ts`. (On Anthropic in production this loop is a candidate for the Batch API's
   50% discount inside the Anthropic adapter; on the Gemini free tier a batch discount is moot.)
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
