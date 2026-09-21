-- Product metrics views.
--
-- RECORD ONLY. This project has no migration runner; the statements below were
-- applied directly to the hosted project (ixdsddfxkrkytiitfici) via the Supabase
-- MCP on 2026-09-21. This file exists so the schema is reviewable in git.
--
-- Why views rather than analytics events: vault CRUD runs browser -> Supabase
-- directly (lib/library.ts), so no server-side event can observe it. Every vault
-- action leaves a row instead, which makes adoption a query — and, unlike an
-- event stream, one that answers retroactively across all existing history.
--
-- Everything here reads auth.users and spans all users, so the schema is granted
-- to service_role only and is read from the server (app/app/admin/metrics).

create schema if not exists metrics;

revoke all on schema metrics from public, anon, authenticated;
grant usage on schema metrics to service_role;

-- ── Admin exclusion ────────────────────────────────────────────────────────
-- The maker account dwarfs every other user on every feature. Excluding it is
-- the difference between "the vault is used" and "the vault is used by me".
create table if not exists metrics.admin_users (
  user_id  uuid primary key,
  note     text,
  added_at timestamptz not null default now()
);
alter table metrics.admin_users enable row level security;

-- ── Per-user adoption ──────────────────────────────────────────────────────
create or replace view metrics.user_adoption as
with c as (
  select user_id,
         count(*)                                                as conversions,
         count(*) filter (where in_vault)                        as vault_docs,
         count(*) filter (where tags is not null
                            and array_length(tags, 1) > 0)       as tagged_docs,
         count(*) filter (where summary is not null)             as summaries,
         count(*) filter (where brief is not null)               as briefs,
         count(*) filter (where source_connection_id is not null) as synced_docs,
         count(distinct project_id) filter (where project_id is not null) as projects_used,
         max(converted_at)                                       as last_conversion
  from public.conversions group by user_id
),
p  as (select user_id, count(*) as projects,
              count(*) filter (where parent_id is not null) as subprojects
       from public.projects group by user_id),
k  as (select user_id, count(*) as api_keys,
              count(*) filter (where last_used_at is not null) as api_keys_used
       from public.api_keys group by user_id),
sc as (select user_id, count(*) as github_connections
       from public.source_connections group by user_id),
mp as (select user_id, count(*) as map_nodes
       from public.vault_map_positions group by user_id)
select u.id                               as user_id,
       u.created_at::date                 as signed_up_on,
       (a.user_id is not null)            as is_admin,
       coalesce(c.conversions, 0)         as conversions,
       coalesce(c.vault_docs, 0)          as vault_docs,
       coalesce(c.tagged_docs, 0)         as tagged_docs,
       coalesce(c.summaries, 0)           as summaries,
       coalesce(c.briefs, 0)              as briefs,
       coalesce(c.synced_docs, 0)         as synced_docs,
       coalesce(p.projects, 0)            as projects,
       coalesce(p.subprojects, 0)         as subprojects,
       coalesce(k.api_keys, 0)            as api_keys,
       coalesce(k.api_keys_used, 0)       as api_keys_used,
       coalesce(sc.github_connections, 0) as github_connections,
       coalesce(mp.map_nodes, 0)          as map_nodes,
       c.last_conversion                  as last_conversion_at
from auth.users u
left join c  on c.user_id  = u.id
left join p  on p.user_id  = u.id
left join k  on k.user_id  = u.id
left join sc on sc.user_id = u.id
left join mp on mp.user_id = u.id
left join metrics.admin_users a on a.user_id = u.id;

-- ── Activity ───────────────────────────────────────────────────────────────
create or replace view metrics.activity_daily as
select d.date,
       case d.identifier_type when 'user' then 'signed_in' else 'anonymous' end as audience,
       count(distinct d.identifier) as actors,
       sum(d.conversion_count)      as conversions
from public.daily_usage d
where not (
  d.identifier_type = 'user'
  and exists (select 1 from metrics.admin_users a where a.user_id::text = d.identifier)
)
group by d.date, 2;

comment on view metrics.activity_daily is
  'Conversion activity per day from the rate-limit ledger (daily_usage). Counts metered conversion REQUESTS, so it excludes documents that enter the vault via GitHub sync, MCP or manual notes. For document counts use metrics.user_adoption / public.conversions instead. Admin users excluded.';

create or replace view metrics.active_users as
select
  (select count(distinct identifier) from public.daily_usage
    where identifier_type = 'user' and date > current_date - 1
      and not exists (select 1 from metrics.admin_users a where a.user_id::text = identifier)) as dau,
  (select count(distinct identifier) from public.daily_usage
    where identifier_type = 'user' and date > current_date - 7
      and not exists (select 1 from metrics.admin_users a where a.user_id::text = identifier)) as wau,
  (select count(distinct identifier) from public.daily_usage
    where identifier_type = 'user' and date > current_date - 30
      and not exists (select 1 from metrics.admin_users a where a.user_id::text = identifier)) as mau;

comment on view metrics.active_users is
  'DAU/WAU/MAU for signed-in users, from metered conversion requests. Anonymous visitors have no stable identity and are deliberately absent; see metrics.activity_daily for anonymous volume.';

-- ── Activation funnel (the pricing view) ───────────────────────────────────
create or replace view metrics.funnel_activation as
with base as (
  select date_trunc('week', signed_up_on)::date as signup_week, *
  from metrics.user_adoption where not is_admin
)
select signup_week,
       count(*)                                 as signed_up,
       count(*) filter (where conversions >= 1) as converted_once,
       count(*) filter (where conversions >= 3) as converted_3plus,
       count(*) filter (where vault_docs  >= 1) as used_vault,
       count(*) filter (where projects    >= 1) as created_project,
       count(*) filter (where last_conversion_at > now() - interval '30 days') as active_last_30d
from base group by signup_week order by signup_week;

-- ── Feature reach ──────────────────────────────────────────────────────────
-- Denominator is activated users (>=1 conversion): someone who never converted
-- never got far enough to see these features.
create or replace view metrics.feature_reach as
with u as (select * from metrics.user_adoption where not is_admin),
     d as (select count(*) filter (where conversions >= 1) as activated, count(*) as signed_up from u),
     f(sort_order, feature, users_reached) as (
  select 1,  'converted',     (select count(*) from u where conversions  >= 1)
  union all select 2,  'vault',        (select count(*) from u where vault_docs  >= 1)
  union all select 3,  'projects',     (select count(*) from u where projects    >= 1)
  union all select 4,  'subprojects',  (select count(*) from u where subprojects >= 1)
  union all select 5,  'tags',         (select count(*) from u where tagged_docs >= 1)
  union all select 6,  'map',          (select count(*) from u where map_nodes   >= 1)
  union all select 7,  'summaries',    (select count(*) from u where summaries   >= 1)
  union all select 8,  'briefs',       (select count(*) from u where briefs      >= 1)
  union all select 9,  'github_sync',  (select count(*) from u where github_connections >= 1)
  union all select 10, 'api_key_made', (select count(*) from u where api_keys      >= 1)
  union all select 11, 'api_key_used', (select count(*) from u where api_keys_used >= 1)
  union all select 12, 'mcp',          (select count(distinct k.user_id) from public.mcp_usage m
                                          join public.api_keys k on k.id = m.key_id
                                         where not exists (select 1 from metrics.admin_users a where a.user_id = k.user_id))
)
select f.feature,
       f.users_reached,
       d.activated,
       round(100.0 * f.users_reached / nullif(d.activated, 0), 1) as pct_of_activated
from f, d order by f.sort_order;

-- ── Quota pressure ─────────────────────────────────────────────────────────
-- Limits mirror lib/usage-math.ts: AUTH_DAILY_LIMIT = 20, ANON_LIFETIME_LIMIT = 3.
-- If those change in code, change them here too.
create or replace view metrics.quota_pressure as
select 'signed_in'::text as audience,
       d.identifier      as actor,
       d.date            as on_date,
       d.conversion_count,
       20                as limit_value
from public.daily_usage d
where d.identifier_type = 'user'
  and d.conversion_count >= 20
  and not exists (select 1 from metrics.admin_users a where a.user_id::text = d.identifier)
union all
select 'anonymous',
       a.identifier,
       a.updated_at::date,
       a.conversion_count,
       3
from public.anon_usage a
where a.conversion_count >= 3;

grant select on metrics.user_adoption, metrics.activity_daily, metrics.active_users,
               metrics.funnel_activation, metrics.feature_reach, metrics.quota_pressure
  to service_role;

-- ── Read surface for the admin page ────────────────────────────────────────
-- The metrics schema is deliberately NOT exposed to PostgREST (it spans all
-- users). This one function is, so the page can read it with the service role
-- in a single round trip. SECURITY DEFINER to reach the unexposed schema;
-- execute granted to service_role only, so an anon or user JWT cannot call it
-- even knowing the name.
create or replace function public.metrics_snapshot()
returns jsonb
language sql
security definer
set search_path = metrics, public, pg_temp
stable
as $$
  select jsonb_build_object(
    'generated_at', now(),
    'active', (select to_jsonb(a) from metrics.active_users a),
    'totals', (
      select jsonb_build_object(
        'signed_up',       count(*),
        'activated',       count(*) filter (where conversions >= 1),
        'never_converted', count(*) filter (where conversions = 0),
        'used_vault',      count(*) filter (where vault_docs >= 1),
        'conversions',     coalesce(sum(conversions), 0),
        'vault_docs',      coalesce(sum(vault_docs), 0)
      ) from metrics.user_adoption where not is_admin
    ),
    'feature_reach', (select jsonb_agg(to_jsonb(f)) from metrics.feature_reach f),
    'funnel',        (select jsonb_agg(to_jsonb(x)) from (
                        select * from metrics.funnel_activation order by signup_week desc limit 12) x),
    'activity',      (select jsonb_agg(to_jsonb(x)) from (
                        select * from metrics.activity_daily order by date desc limit 60) x),
    'quota',         (select jsonb_build_object(
                        'signed_in_hits',  count(*) filter (where audience = 'signed_in'),
                        'anonymous_hits',  count(*) filter (where audience = 'anonymous'),
                        'distinct_actors', count(distinct actor)
                      ) from metrics.quota_pressure)
  );
$$;

revoke all on function public.metrics_snapshot() from public, anon, authenticated;
grant execute on function public.metrics_snapshot() to service_role;
