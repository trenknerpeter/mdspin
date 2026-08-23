-- Stage 2c: dual-auth Knowledge Map. build_knowledge_graph_v2 mirrors the algorithm from build_knowledge_graph (20260820_relatedness_v2.sql) with p_user_id replacing auth.uid(); build_knowledge_graph is redefined as a thin wrapper over it. Deliberately vault-wide (distinctive-term rule), not project-scoped — see the 2026-08-21 amendment. No lib/vault/repo.ts wrapper for the v2 function yet; no Stage 2 consumer needs it.
--
-- WHY, carried forward from 20260820_relatedness_v2.sql so a reader of THIS (now-live)
-- function isn't left guessing:
--
-- The distinctive-term / rare-lexeme rule (the `rare` CTE) exists because counting shared
-- terms without weighting them by how common they are is nearly always satisfiable: in one
-- real vault 'data' appeared in 12 of 14 docs, 'free' in 9, 'featur' in 8 — so "shares 2
-- distinct terms" matched almost every pair, and unrelated docs surfaced on filler
-- vocabulary alone. Requiring at least one shared term that appears in at most ~a third of
-- the vault (`n.total * 0.34`, floored at `greatest(2.0, ...)` so small vaults don't starve)
-- cut candidate pairs roughly 5x and correctly left most documents showing no edges at all.
-- Raising the overlap-count threshold instead of adding this rule makes results WORSE, not
-- better: long documents trivially share many common terms, so a higher count threshold
-- re-admits exactly the noise this rule removes — it is a distinctiveness gate, not a
-- quantity dial.
--
-- df (document frequency, inside `rare`) is computed ONCE over the vault's distinct lexemes,
-- not per source node inside the lateral join — doing it per-node would make this
-- O(nodes x terms x nodes) on every Map load instead of linear.
--
-- Deliberately vault-wide, not project-scoped (unlike find_related_documents in
-- 20260822_find_related_documents.sql): the Map's whole value is showing cross-project
-- edges the project-scoped panel can't — project-scoping it would just redraw the clustering
-- the Map's own node colours already show. See the 2026-08-21 amendment; revisit the two
-- functions' scope together, not separately, if that ever changes.

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
