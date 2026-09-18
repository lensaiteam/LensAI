# Deploying the engine on Railway

One Railway **service** runs the whole engine — capture daemon, derive/brief/watch
loop, and the agent HTTP API — because a Railway volume (and therefore the SQLite
corpus) attaches to exactly one service. The Next.js web app stays on Netlify.

> The image has not been built on the dev box (no Docker there). Treat the first
> deploy as the test: watch the build log, then `GET /health`.

## 1. Create the service

1. New Project → Deploy from GitHub repo → `lensaiteam/LensAI`. `railway.json`
   selects the `Dockerfile` build and the `/health` check.
2. **Add a Volume** mounted at `/data` (the image sets `CAPTURE_DB_PATH=/data/capture.db`).
3. Settings → Networking → **Generate Domain**. That URL is `NEXT_PUBLIC_AGENT_URL`
   for the web app and the base URL for API-key clients.
4. Keep **replicas = 1**. A second replica would be a second SQLite writer.

## 2. Variables

Required:

| Variable | Value |
|---|---|
| `SESSION_JWT_SECRET` | **the same value as the web app** — it verifies the agent tokens the web app mints |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | user state (apply `db/migrations/0002_agent.sql` first) |
| `AGENT_ALLOWED_ORIGIN` | the web origin, e.g. `https://lensai.example` |
| one or more LLM keys | `GEMINI_API_KEY`, `GROQ_API_KEY`, `MISTRAL_API_KEY`, `OPENROUTER_API_KEY`, `CLOUDFLARE_API_TOKEN` (+ `CLOUDFLARE_ACCOUNT_ID`) — **one key per provider** |

Backup (strongly recommended — the corpus cannot be rebuilt retroactively):

| Variable | Value |
|---|---|
| `LITESTREAM_BUCKET` | bucket name (any S3-compatible store, e.g. Cloudflare R2) |
| `LITESTREAM_ENDPOINT` | R2: `https://<account-id>.r2.cloudflarestorage.com` |
| `LITESTREAM_ACCESS_KEY_ID`, `LITESTREAM_SECRET_ACCESS_KEY` | bucket credentials |

Optional: `FRED_API_KEY` (macro), `TELEGRAM_BOT_TOKEN` + `TELEGRAM_BOT_NAME`,
`RESEND_API_KEY` + `ALERT_FROM_EMAIL`, `SERA_TOOLS_TOKEN` (engine-level `/rpc`
token), and the tuning knobs in `.env.example` (AGENT section).

Railway injects `PORT`; the server binds to it automatically.

## 3. First boot

`deploy/start.sh` restores the corpus from the replica if the volume is empty,
then runs the engine under `litestream replicate`. On boot the service applies
SQLite migrations, loads the mechanism graph (idempotent), starts capture, and
runs a derive cycle immediately.

Moving an existing corpus in: replicate it from the old host to the bucket with
litestream, then deploy — the empty volume restores from it. Verify with
`GET /health` (`anchor` becomes non-null after the first derive cycle).

## 4. Operating notes

- A deploy restarts the single service (volumes rule out zero-downtime deploys).
  Capture is slot-idempotent and restart-safe, so this costs at most one tick.
- `GET /health` reports the LLM pool: which providers are configured, today's
  usage against the configured limits, and which are cooling down.
- After editing `config/llm-pool.json`, run `npm run llm:eval` locally before
  deploying — it admits or rejects each provider's models on fixed cases.
- The Postgres lift (OPEN_QUESTIONS.md) becomes relevant only when a second
  service or host needs the corpus. Until then SQLite + WAL on one volume is fine.
