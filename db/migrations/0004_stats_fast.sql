-- 0004_stats_fast.sql: platform_stats() rewritten as single-pass aggregation.
-- 0003 computed every day's figures with correlated subqueries, which scanned each
-- table once per day and hit the API statement timeout. This version groups each
-- table by day once and joins the results onto the calendar. Same JSON shape.

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
act as (select day, count(distinct wallet_address) as c from activity group by day),
nu  as (select created_at::date as day, count(*) as c from users group by 1),
se  as (select created_at::date as day, count(*) as c from analysis_sessions group by 1),
um  as (select created_at::date as day, count(*) as c from messages where role = 'user' group by 1),
ul  as (select created_at::date as day,
               count(*) filter (where not cache_hit) as model_calls,
               count(*) filter (where cache_hit)     as cache_hits
        from usage_log group by 1),
ac  as (select created_at::date as day, count(*) as c from agent_conversations group by 1),
am  as (select created_at::date as day, count(*) as c from agent_messages where role = 'user' group by 1),
aw  as (select created_at::date as day, count(*) as c from agent_watches group by 1),
tr  as (select to_timestamp(fired_at / 1000.0)::date as day, count(*) as c from agent_watch_triggers group by 1),
cc  as (select created_at::date as day, count(*) as c from agent_claim_checks group by 1),
daily as (
  select
    d.day,
    coalesce(act.c, 0)          as active_wallets,
    coalesce(nu.c, 0)           as new_wallets,
    coalesce(se.c, 0)           as analyses,
    coalesce(um.c, 0)           as user_messages,
    coalesce(ul.model_calls, 0) as model_calls,
    coalesce(ul.cache_hits, 0)  as cache_hits,
    coalesce(ac.c, 0)           as agent_conversations,
    coalesce(am.c, 0)           as agent_questions,
    coalesce(aw.c, 0)           as agent_watches_created,
    coalesce(tr.c, 0)           as agent_triggers,
    coalesce(cc.c, 0)           as agent_claim_checks
  from days d
  left join act on act.day = d.day
  left join nu  on nu.day  = d.day
  left join se  on se.day  = d.day
  left join um  on um.day  = d.day
  left join ul  on ul.day  = d.day
  left join ac  on ac.day  = d.day
  left join am  on am.day  = d.day
  left join aw  on aw.day  = d.day
  left join tr  on tr.day  = d.day
  left join cc  on cc.day  = d.day
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

revoke all on function public.platform_stats() from public, anon, authenticated;
