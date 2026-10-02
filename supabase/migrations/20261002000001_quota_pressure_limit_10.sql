-- Update quota_pressure metrics view to use 10-day limit.
--
-- RECORD ONLY. This project has no migration runner; the statements below were
-- applied directly to the hosted project (ixdsddfxkrkytiitfici) via the Supabase
-- MCP on 2026-10-02. This file exists so the schema is reviewable in git.
--
-- Limits mirror lib/usage-math.ts: AUTH_DAILY_LIMIT = 10 from 2026-10-02.

create or replace view metrics.quota_pressure as
select 'signed_in'::text as audience,
       d.identifier      as actor,
       d.date            as on_date,
       d.conversion_count,
       10                as limit_value
from public.daily_usage d
where d.identifier_type = 'user'
  and d.conversion_count >= 10
  and not exists (select 1 from metrics.admin_users a where a.user_id::text = d.identifier)
union all
select 'anonymous',
       a.identifier,
       a.updated_at::date,
       a.conversion_count,
       3
from public.anon_usage a
where a.conversion_count >= 3;

grant select on metrics.quota_pressure to service_role;
