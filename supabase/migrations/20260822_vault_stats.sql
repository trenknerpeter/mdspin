-- Stage 2c: aggregate vault stats for vault_overview (Stage 2e) and /api/v1/vault/stats (Stage 2d).
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
    (select count(distinct project_id) from scope where project_id is not null)::integer,
    coalesce((select jsonb_agg(jsonb_build_object('tag', tag, 'count', n)) from tag_counts), '[]'::jsonb)
$$;
