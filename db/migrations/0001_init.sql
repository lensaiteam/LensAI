-- =====================================================================
-- LensAI — Supabase / Postgres schema  (see CLAUDE.md §8–§10)
--   * Identity IS the wallet address. No email/password/PII.
--   * Login is SIWE, NOT Supabase Auth. RLS (Path A) reads a
--     "wallet_address" JWT claim via app.current_wallet(). Under Path B
--     (service-role, server-side only) RLS is a backstop.
--   * SENSITIVE: wallet_address + research history (sessions/messages).
--   * token_cache is SHARED content — kept out of user-scoped RLS.
-- =====================================================================

create extension if not exists "pgcrypto";
create schema if not exists app;

create or replace function app.current_wallet()
returns text language sql stable as $$
  select lower(coalesce(
    current_setting('request.jwt.claims', true)::json ->> 'wallet_address', ''));
$$;

-- IDENTITY ------------------------------------------------------------
create table if not exists users (
  wallet_address text primary key
                   check (wallet_address = lower(wallet_address)),
  chain_id       integer not null default 1,
  created_at     timestamptz not null default now(),
  last_login_at  timestamptz not null default now()
);

create table if not exists auth_nonces (
  nonce       text primary key,
  wallet_hint text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '10 minutes'),
  used        boolean not null default false
);

-- PRODUCT DATA (sensitive, user-scoped) -------------------------------
create table if not exists analysis_sessions (
  id             uuid primary key default gen_random_uuid(),
  wallet_address text not null references users(wallet_address) on delete cascade,
  ticker         text not null,
  created_at     timestamptz not null default now()
);

create table if not exists messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references analysis_sessions(id) on delete cascade,
  role       text not null check (role in ('user','assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);

create table if not exists watchlist (
  wallet_address text not null references users(wallet_address) on delete cascade,
  ticker         text not null,
  created_at     timestamptz not null default now(),
  primary key (wallet_address, ticker)
);

-- OPERATIONAL ---------------------------------------------------------
create table if not exists usage_log (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid references analysis_sessions(id) on delete set null,
  wallet_address text references users(wallet_address) on delete set null,
  model          text not null,
  input_tokens   integer not null default 0,
  output_tokens  integer not null default 0,
  web_searches   integer not null default 0,
  cache_hit      boolean not null default false,
  created_at     timestamptz not null default now()
);

create table if not exists free_tier_usage (
  wallet_address text primary key references users(wallet_address) on delete cascade,
  free_used      integer not null default 0,
  updated_at     timestamptz not null default now()
);

create table if not exists rate_limits (
  wallet_address text not null references users(wallet_address) on delete cascade,
  window_start   timestamptz not null,
  request_count  integer not null default 0,
  primary key (wallet_address, window_start)
);

-- SHARED CONTENT (NOT user data) --------------------------------------
-- Stores the ticker's gathered DATA as structured fields so follow-ups
-- (sentiment / news / supply / risk) can be served without a new model
-- call or search. See CLAUDE.md §4.7 and §5.4.
create table if not exists token_cache (
  ticker       text primary key check (ticker = upper(ticker)),
  analysis     jsonb not null,   -- the final structured 6-section analysis
  market_data  jsonb,            -- price / mcap / volume / supply snapshot
  news_digest  jsonb,            -- recent news items (pre-fetched or searched)
  sentiment    jsonb,            -- sentiment read (tone, sources)
  tokenomics   jsonb,            -- supply model, unlocks, concentration
  risk_flags   jsonb,            -- liquidity / volatility / security flags
  model        text,
  generated_at timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '30 minutes')
);

-- INDEXES -------------------------------------------------------------
create index if not exists idx_sessions_wallet    on analysis_sessions(wallet_address, created_at desc);
create index if not exists idx_messages_session   on messages(session_id, created_at);
create index if not exists idx_usage_wallet       on usage_log(wallet_address, created_at desc);
create index if not exists idx_nonces_expiry      on auth_nonces(expires_at);
create index if not exists idx_token_cache_expiry on token_cache(expires_at);

-- RLS (Path A) --------------------------------------------------------
-- NOTE: LensAI runs Path B (service-role, server-side). These policies are a
-- defence-in-depth backstop; the service-role key bypasses them.
alter table users             enable row level security;
alter table analysis_sessions enable row level security;
alter table messages          enable row level security;
alter table watchlist         enable row level security;
alter table usage_log         enable row level security;
alter table free_tier_usage   enable row level security;
alter table rate_limits       enable row level security;

create policy users_self_select on users
  for select using (wallet_address = app.current_wallet());
create policy users_self_update on users
  for update using (wallet_address = app.current_wallet());

create policy sessions_owner_all on analysis_sessions
  for all using (wallet_address = app.current_wallet())
  with check (wallet_address = app.current_wallet());

create policy messages_owner_all on messages
  for all using (exists (
      select 1 from analysis_sessions s
      where s.id = messages.session_id
        and s.wallet_address = app.current_wallet()))
  with check (exists (
      select 1 from analysis_sessions s
      where s.id = messages.session_id
        and s.wallet_address = app.current_wallet()));

create policy watchlist_owner_all on watchlist
  for all using (wallet_address = app.current_wallet())
  with check (wallet_address = app.current_wallet());

create policy usage_owner_select on usage_log
  for select using (wallet_address = app.current_wallet());
create policy freetier_owner_select on free_tier_usage
  for select using (wallet_address = app.current_wallet());
create policy ratelimits_owner_select on rate_limits
  for select using (wallet_address = app.current_wallet());

-- token_cache and auth_nonces: NO user RLS. Service-role access only.

-- CLEANUP -------------------------------------------------------------
create or replace function app.cleanup_nonces()
returns void language sql as $$
  delete from auth_nonces where used = true or expires_at < now();
$$;

create or replace function app.cleanup_token_cache()
returns void language sql as $$
  delete from token_cache where expires_at < now();
$$;
-- Schedule via pg_cron if enabled:
-- select cron.schedule('purge-nonces','*/5 * * * *',$$select app.cleanup_nonces();$$);
-- select cron.schedule('purge-cache','*/15 * * * *',$$select app.cleanup_token_cache();$$);

-- ACCOUNT DELETION ----------------------------------------------------
-- Cascades to sessions->messages, watchlist, free_tier_usage, rate_limits.
-- usage_log de-links (set null) so aggregate cost accounting survives.
create or replace function app.delete_account(target_wallet text)
returns void language sql as $$
  delete from users where wallet_address = lower(target_wallet);
$$;
