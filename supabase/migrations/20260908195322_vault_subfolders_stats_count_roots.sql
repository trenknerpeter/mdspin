-- RECORD ONLY. Applied to the hosted Supabase project (ixdsddfxkrkytiitfici) via the
-- Supabase MCP on 2026-09-08; this project has no migration runner.
--
-- Body-only change: project_count counts ROOT projects, so splitting one project into
-- sub-folders doesn't silently inflate the number a user sees. Without this, filing
-- Plato PM's documents into six sub-folders would turn "6 projects" into "11" in
-- vault_overview (MCP) and GET /api/v1/vault/stats -- nothing errors, a number just
-- quietly becomes wrong. Measured on the live vault: 6 before and after a split.
create or replace function public.vault_stats(p_user_id uuid)
returns table(
  document_count integer,
  project_count integer,
  top_tags jsonb
)
language sql
stable
set search_path to 'public'
as $$
  with scope as (
    select c.tags, c.project_id
    from public.conversions c
    where c.user_id = p_user_id and c.in_vault = true
      and public.vault_actor_ok(p_user_id)
  ),
  tag_counts as (
    select t as tag, count(*) as n
    from scope, unnest(scope.tags) as t
    group by t
    order by n desc, t
    limit 10
  )
  select
    (select count(*) from scope)::integer,
    (select count(distinct coalesce(p.parent_id, p.id))
       from scope s
       join public.projects p on p.id = s.project_id
      where s.project_id is not null)::integer,
    coalesce((select jsonb_agg(jsonb_build_object('tag', tag, 'count', n) order by n desc, tag) from tag_counts), '[]'::jsonb)
$$;
