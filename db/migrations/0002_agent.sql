-- =====================================================================
-- LensAI — agent user state (Supabase / Postgres). Extends 0001_init.sql.
--   * Identity stays the wallet address; every table cascades from users, so
--     app.delete_account() erases ALL agent data with the account.
--   * Optional contact fields (email / telegram chat id) exist ONLY if the
--     user turns that alert channel on.
--   * NOTHING here is ever copied into the append-only capture corpus or the
--     `briefs` calibration record, and no column here is ever placed in an
--     LLM prompt (src/lib/agent/privacy.ts gates that).
--   * No IPs are stored: per-minute rate limiting is in-memory in the service.
-- =====================================================================

-- PREFERENCES ---------------------------------------------------------
create table if not exists agent_prefs (
  wallet_address     text primary key references users(wallet_address) on delete cascade,
  watchlist          text[] not null default '{}',   -- symbols only; no amounts/balances
  timezone           text,
  email              text,                           -- only if email alerts are on
  telegram_chat_id   text,                           -- only if Telegram alerts are on
  telegram_link_code text,                           -- one-time bot link code
  last_seen_as_of    bigint,                         -- epoch ms; powers "what changed"
  updated_at         timestamptz not null default now()
);
create index if not exists idx_agent_prefs_link_code on agent_prefs(telegram_link_code) where telegram_link_code is not null;

-- CONVERSATIONS (sensitive, user-scoped, auto-expiring) ----------------
create table if not exists agent_conversations (
  id             uuid primary key default gen_random_uuid(),
  wallet_address text not null references users(wallet_address) on delete cascade,
  title          text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists agent_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references agent_conversations(id) on delete cascade,
  role            text not null check (role in ('user','assistant')),
  content         text not null,
  meta            jsonb,            -- assistant turns: as_of + claim audit
  created_at      timestamptz not null default now()
);

-- WATCHES -------------------------------------------------------------
create table if not exists agent_watches (
  id                   uuid primary key default gen_random_uuid(),
  wallet_address       text not null references users(wallet_address) on delete cascade,
  text                 text not null,       -- the user's plain-language request
  rule                 jsonb not null,      -- compiled rule DSL (arithmetic only)
  description          text not null,       -- deterministic echo the user confirmed
  channel              text not null check (channel in ('telegram','email')),
  status               text not null default 'active' check (status in ('active','paused')),
  last_state           boolean not null default false,
  last_evaluated_as_of bigint,
  last_fired_at        bigint,
  created_at           timestamptz not null default now()
);

create table if not exists agent_watch_triggers (
  id        uuid primary key default gen_random_uuid(),
  watch_id  uuid not null references agent_watches(id) on delete cascade,
  fired_at  bigint not null,
  as_of     bigint not null,
  message   text not null,
  delivered boolean not null default false
);

-- USAGE (quota for the finite free LLM pool) --------------------------
create table if not exists agent_usage_daily (
  wallet_address text not null references users(wallet_address) on delete cascade,
  kind           text not null,
  day            date not null,
  count          integer not null default 0,
  primary key (wallet_address, kind, day)
);

-- In `public` (not `app`) so the service-role client can call it via rpc();
-- execute is revoked from the browser-facing roles below.
create or replace function public.bump_agent_usage(p_wallet text, p_kind text, p_day date)
returns integer language sql as $$
  insert into agent_usage_daily (wallet_address, kind, day, count)
  values (lower(p_wallet), p_kind, p_day, 1)
  on conflict (wallet_address, kind, day) do update set count = agent_usage_daily.count + 1
  returning count;
$$;
revoke execute on function public.bump_agent_usage(text, text, date) from public, anon, authenticated;

-- API KEYS (tool endpoint). Only a SHA-256 hash is stored; the key is shown once.
create table if not exists agent_api_keys (
  id             uuid primary key default gen_random_uuid(),
  wallet_address text not null references users(wallet_address) on delete cascade,
  label          text not null,
  prefix         text not null,
  key_hash       text not null unique,
  created_at     timestamptz not null default now(),
  last_used_at   timestamptz,
  revoked        boolean not null default false
);

-- CLAIM CHECKS --------------------------------------------------------
create table if not exists agent_claim_checks (
  id             uuid primary key default gen_random_uuid(),
  wallet_address text not null references users(wallet_address) on delete cascade,
  input          text not null,
  result         jsonb not null,
  created_at     timestamptz not null default now()
);

-- FEEDBACK ------------------------------------------------------------
create table if not exists agent_feedback (
  id             uuid primary key default gen_random_uuid(),
  wallet_address text not null references users(wallet_address) on delete cascade,
  message_id     uuid not null,
  rating         smallint not null check (rating in (-1, 1)),
  note           text,
  created_at     timestamptz not null default now()
);

-- INDEXES -------------------------------------------------------------
create index if not exists idx_agent_conv_wallet    on agent_conversations(wallet_address, updated_at desc);
create index if not exists idx_agent_msg_conv       on agent_messages(conversation_id, created_at);
create index if not exists idx_agent_watches_wallet on agent_watches(wallet_address);
create index if not exists idx_agent_watches_active on agent_watches(status) where status = 'active';
create index if not exists idx_agent_triggers_watch on agent_watch_triggers(watch_id, fired_at desc);
create index if not exists idx_agent_checks_wallet  on agent_claim_checks(wallet_address, created_at desc);

-- RLS (defence-in-depth backstop; the service runs Path B / service-role) ----
alter table agent_prefs          enable row level security;
alter table agent_conversations  enable row level security;
alter table agent_messages       enable row level security;
alter table agent_watches        enable row level security;
alter table agent_watch_triggers enable row level security;
alter table agent_usage_daily    enable row level security;
alter table agent_api_keys       enable row level security;
alter table agent_claim_checks   enable row level security;
alter table agent_feedback       enable row level security;

create policy agent_prefs_owner on agent_prefs
  for all using (wallet_address = app.current_wallet()) with check (wallet_address = app.current_wallet());
create policy agent_conv_owner on agent_conversations
  for all using (wallet_address = app.current_wallet()) with check (wallet_address = app.current_wallet());
create policy agent_msg_owner on agent_messages
  for all using (exists (select 1 from agent_conversations c where c.id = agent_messages.conversation_id and c.wallet_address = app.current_wallet()))
  with check (exists (select 1 from agent_conversations c where c.id = agent_messages.conversation_id and c.wallet_address = app.current_wallet()));
create policy agent_watches_owner on agent_watches
  for all using (wallet_address = app.current_wallet()) with check (wallet_address = app.current_wallet());
create policy agent_triggers_owner on agent_watch_triggers
  for select using (exists (select 1 from agent_watches w where w.id = agent_watch_triggers.watch_id and w.wallet_address = app.current_wallet()));
create policy agent_usage_owner on agent_usage_daily
  for select using (wallet_address = app.current_wallet());
create policy agent_keys_owner on agent_api_keys
  for select using (wallet_address = app.current_wallet());
create policy agent_checks_owner on agent_claim_checks
  for all using (wallet_address = app.current_wallet()) with check (wallet_address = app.current_wallet());
create policy agent_feedback_owner on agent_feedback
  for all using (wallet_address = app.current_wallet()) with check (wallet_address = app.current_wallet());

-- RETENTION -----------------------------------------------------------
-- Conversations idle past the retention window are dropped (messages cascade).
create or replace function public.purge_agent_conversations(p_days integer)
returns integer language plpgsql as $$
declare n integer;
begin
  delete from agent_conversations where updated_at < now() - make_interval(days => p_days);
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.purge_agent_conversations(integer) from public, anon, authenticated;
-- Optional pg_cron: select cron.schedule('purge-agent','17 3 * * *',$$select public.purge_agent_conversations(90);$$);
