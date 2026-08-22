-- Stage 2c: dual-auth Knowledge Map. build_knowledge_graph_v2 mirrors the algorithm from build_knowledge_graph (20260820_relatedness_v2.sql) with p_user_id replacing auth.uid(); build_knowledge_graph is redefined as a thin wrapper over it. Deliberately vault-wide (distinctive-term rule), not project-scoped — see the 2026-08-21 amendment. No lib/vault/repo.ts wrapper for the v2 function yet; no Stage 2 consumer needs it.

create or replace function public.build_knowledge_graph_v2(
  p_user_id uuid,
  p_max_per_node integer default 5
)
returns table(source_id uuid, target_id uuid, weight real)
language sql
stable
set search_path to 'public'
as $$
  with vault as (
    select c.id, c.search_vector,
           public.relatedness_lexemes(c.title, c.tags, c.filename) as lx,
           public.relatedness_query(c.title, c.tags, c.filename)   as q
    from public.conversions c
    where c.user_id = p_user_id and c.in_vault = true
      and public.vault_actor_ok(p_user_id)
  ),
  n as (select count(*)::float as total from vault),
  alllex as (select distinct unnest(lx) as lex from vault),
  rare as (
    select coalesce(array_agg(a.lex), '{}'::text[]) as lexemes
    from alllex a, n
    where (select count(*) from vault v where a.lex = any (tsvector_to_array(v.search_vector)))::float
          <= greatest(2.0, n.total * 0.34)
  )
  select s.id as source_id, t.id as target_id, t.rank as weight
  from vault s
  cross join rare
  cross join lateral (
    select c.id, ts_rank('{0.1,0.2,0.4,1.0}'::float4[], c.search_vector, s.q, 2|32) as rank
    from vault c
    where c.id <> s.id
      and s.q @@ c.search_vector
      and (select count(*) from unnest(s.lx) l where l = any (tsvector_to_array(c.search_vector)))
          >= least(2, cardinality(s.lx))
      and exists (
        select 1 from unnest(s.lx) l
        where l = any (rare.lexemes) and l = any (tsvector_to_array(c.search_vector))
      )
    order by rank desc
    limit p_max_per_node
  ) t;
$$;

create or replace function public.build_knowledge_graph(max_per_node integer default 5)
returns table(source_id uuid, target_id uuid, weight real)
language sql
stable
set search_path to 'public'
as $$
  select * from public.build_knowledge_graph_v2(auth.uid(), max_per_node)
$$;
