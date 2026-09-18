-- 0003_stats.sql: platform statistics for the public analytics page.
-- One function returns AGGREGATES ONLY as JSON: per-day counts, per-ticker counts
-- and running totals. Wallets are counted, never listed; no message text, email
-- or key is read. Called with the service role from the web app (revalidated
-- hourly) and never exposed to anon or authenticated clients.

create or replace function public.platform_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with bounds as (
  select coalesce(min(created_at)::date, current_date) as first_day from users
),
days as (
  select d::date as day
  from bounds, generate_series(bounds.first_day, current_date, interval '1 day') as d
),
activity as (
  select created_at::date as day, wallet_address from users
  union
  select created_at::date, wallet_address from analysis_sessions
  union
  select created_at::date, wallet_address from usage_log where wallet_address is not null
  union
  select m.created_at::date, s.wallet_address from messages m join analysis_sessions s on s.id = m.session_id
  union
  select created_at::date, wallet_address from agent_conversations
  union
  select m.created_at::date, c.wallet_address from agent_messages m join agent_conversations c on c.id = m.conversation_id
  union
  select created_at::date, wallet_address from agent_watches
  union
  select created_at::date, wallet_address from agent_claim_checks
),
daily as (
  select
    d.day,
    (select count(distinct a.wallet_address) from activity a where a.day = d.day)                           as active_wallets,
    (select count(*) from users u where u.created_at::date = d.day)                                          as new_wallets,
    (select count(*) from analysis_sessions s where s.created_at::date = d.day)                              as analyses,
    (select count(*) from messages m where m.created_at::date = d.day and m.role = 'user')                   as user_messages,
    (select count(*) from usage_log l where l.created_at::date = d.day and not l.cache_hit)                  as model_calls,
    (select count(*) from usage_log l where l.created_at::date = d.day and l.cache_hit)                      as cache_hits,
    (select count(*) from agent_conversations c where c.created_at::date = d.day)                            as agent_conversations,
    (select count(*) from agent_messages m where m.created_at::date = d.day and m.role = 'user')             as agent_questions,
    (select count(*) from agent_watches w where w.created_at::date = d.day)                                  as agent_watches_created,
    (select count(*) from agent_watch_triggers t where to_timestamp(t.fired_at / 1000.0)::date = d.day)      as agent_triggers,
    (select count(*) from agent_claim_checks c where c.created_at::date = d.day)                             as agent_claim_checks
  from days d
)
select jsonb_build_object(
  'generated_at', now(),
  'daily', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'day', to_char(day, 'YYYY-MM-DD'),
      'active_wallets', active_wallets,
      'new_wallets', new_wallets,
      'analyses', analyses,
      'followups', greatest(user_messages - analyses, 0),
      'model_calls', model_calls,
      'cache_hits', cache_hits,
      'agent_conversations', agent_conversations,
      'agent_questions', agent_questions,
      'agent_watches_created', agent_watches_created,
      'agent_triggers', agent_triggers,
      'agent_claim_checks', agent_claim_checks
    ) order by day), '[]'::jsonb)
    from daily
  ),
  'tickers', (
    select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select ticker, count(*) as analyses, count(distinct wallet_address) as unique_wallets
      from analysis_sessions
      group by ticker
      order by analyses desc, ticker
      limit 12
    ) t
  ),
  'totals', jsonb_build_object(
    'wallets',              (select count(*) from users),
    'analyses',             (select count(*) from analysis_sessions),
    'followups',            greatest((select count(*) from messages where role = 'user') - (select count(*) from analysis_sessions), 0),
    'tickers',              (select count(distinct ticker) from analysis_sessions),
    'model_calls',          (select count(*) from usage_log where not cache_hit),
    'cache_hits',           (select count(*) from usage_log where cache_hit),
    'agent_conversations',  (select count(*) from agent_conversations),
    'agent_questions',      (select count(*) from agent_messages where role = 'user'),
    'agent_watches',        (select count(*) from agent_watches),
    'agent_watches_active', (select count(*) from agent_watches where status = 'active'),
    'agent_triggers',       (select count(*) from agent_watch_triggers),
    'agent_claim_checks',   (select count(*) from agent_claim_checks),
    'feedback_up',          (select count(*) from agent_feedback where rating = 1),
    'feedback_down',        (select count(*) from agent_feedback where rating = -1)
  )
);
$$;

-- Service role only: the page reads it server-side and publishes aggregates.
revoke all on function public.platform_stats() from public, anon, authenticated;
