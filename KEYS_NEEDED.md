# KEYS_NEEDED.md

Credentials the capture layer wants but does not yet have. **Rule (invariant): a
stubbed source NEVER emits fake-but-plausible data.** Until a key here is filled
in, its adapter either fetches nothing (free sources degrade to an `ingest_runs`
error row) or throws `NotImplemented` (paid stubs) — it does not invent numbers.

## Free — fill in to widen coverage

| Key | Source | Used for | Where to get it |
|---|---|---|---|
| `FRED_API_KEY` | FRED (St. Louis Fed) | Macro: DXY proxy `DTWEXBGS`, 10y `DGS10` | https://fred.stlouisfed.org/docs/api/api_key.html (free) |

Without `FRED_API_KEY` the macro adapter records an `ingest_runs` error each tick
(visible in `npm run capture:tail`) instead of silently producing a corpus gap.

## Paid / institutional — stubbed interfaces only (Phase 1)

These are priced for funds. The spec says: define the interface, stub it, list it
here. `src/lib/capture/adapters/stubs.ts` throws `NotImplemented` for each.

| Key | Source | Would provide | Status |
|---|---|---|---|
| `ETF_FLOWS_API_KEY` | (vendor TBD) | Spot BTC/ETH ETF creation/redemption flows | stub — quote vendors before wiring |
| `INSTITUTIONAL_DEPTH_API_KEY` | (vendor TBD) | Institutional-grade order-book depth | stub — coarse public depth used meanwhile |

Coarse ±1%/±2% depth from exchange public endpoints (Binance) covers the depth
factor for now; the institutional feed is an upgrade, not a blocker.

## Model providers — the agent

The agent and narration route model calls across a configurable provider pool
(`config/llm-pool.json`) with quota-aware failover. Any one key is enough to
start; more keys add daily capacity and real failover. **One key per provider** —
never stack accounts on the same provider; that violates their terms. Before
go-live, check each provider's current limits and terms (they change), set the
limits in the config accordingly, then run `npm run llm:eval` to admit models.

| Key | Provider | Where to get it |
|---|---|---|
| `GEMINI_API_KEY` | Google AI Studio (already set for v1) | https://aistudio.google.com/apikey |
| `GROQ_API_KEY` | Groq | https://console.groq.com/keys |
| `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Workers AI (small daily allowance — a top-up) | https://dash.cloudflare.com → AI → Workers AI → REST API |
| `MISTRAL_API_KEY` | Mistral La Plateforme | https://console.mistral.ai |
| `OPENROUTER_API_KEY` | OpenRouter | https://openrouter.ai/keys |

Prompts leave our infrastructure and providers may retain them. That is why no user
identifier is ever placed in a prompt (`src/lib/agent/privacy.ts`) — only market
data and the question text.

## Agent service — alert channels + backup (all optional)

| Key | Used for | Where to get it |
|---|---|---|
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_NAME` | Watch alerts via Telegram | @BotFather |
| `RESEND_API_KEY`, `ALERT_FROM_EMAIL` | Watch alerts via email (needs a verified sending domain) | https://resend.com |
| `LITESTREAM_BUCKET`, `LITESTREAM_ENDPOINT`, `LITESTREAM_ACCESS_KEY_ID`, `LITESTREAM_SECRET_ACCESS_KEY` | Off-box corpus replication on the container deploy | Cloudflare R2 / Backblaze B2 |
