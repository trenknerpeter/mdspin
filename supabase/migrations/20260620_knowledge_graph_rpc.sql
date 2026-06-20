-- Record-only (applied to hosted project ixdsddfxkrkytiitfici via Supabase MCP).
--
-- All-pairs generalization of find_related_conversions (20260618): for each of
-- the caller's in-vault docs, emit its top-N related docs as graph edges in one
-- round trip. Powers the Knowledge Graph (Vault → Map) view.
-- security invoker + auth.uid() => RLS holds; never crosses users.
--
-- Unlike find_related_conversions (which ANDs the source terms => "strongly
-- related"), the MAP connects nodes that share ANY topic. We therefore OR the
-- source's title+tag tokens together by inserting "or" between them, which
-- websearch_to_tsquery parses as the OR operator. Without this the graph is
-- almost edgeless (a target would have to contain every source word).
create or replace function public.build_knowledge_graph(max_per_node int default 5)
returns table (source_id uuid, target_id uuid, weight real)
language sql stable security invoker
set search_path = public
as $$
  select s.id as source_id, t.id as target_id, t.rank as weight
  from public.conversions s
  cross join lateral (
    select c.id, ts_rank(c.search_vector, q.query) as rank
    from public.conversions c
    cross join (
      select websearch_to_tsquery('english',
        regexp_replace(
          trim(coalesce(s.title, '') || ' ' || coalesce(array_to_string(s.tags, ' '), '')),
          '\s+', ' or ', 'g'
        )
      ) as query
    ) q
    where c.user_id = auth.uid()
      and c.in_vault = true
      and c.id <> s.id
      and q.query @@ c.search_vector
    order by rank desc
    limit max_per_node
  ) t
  where s.user_id = auth.uid()
    and s.in_vault = true;
$$;
