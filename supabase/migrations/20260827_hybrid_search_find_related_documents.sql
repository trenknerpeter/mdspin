-- Stage 3: find_related_documents blends its existing project-scoped lexical affinity
-- with chunk-level semantic similarity (weighted average, only when both source and
-- candidate already have embeddings — see this task's plan entry for why a missing score
-- must NOT default to 0 here, unlike vault_search_documents' RRF). CREATE OR REPLACE is
-- safe: signature and return type are unchanged from the shipped Stage 2c function.
-- Applied live via Supabase MCP; this file is a record-only mirror.
create or replace function public.find_related_documents(p_user_id uuid, p_source_id uuid, p_max_results integer default 10)
returns table(id uuid, filename text, title text, file_type text, word_count integer, tags text[], project_id uuid, converted_at timestamptz, rank real, strength text)
language sql stable
set search_path to 'public, extensions'
as $$
  with vault as (
    select c.id, c.project_id, c.search_vector
    from public.conversions c
    where c.user_id = p_user_id and c.in_vault = true
      and public.vault_actor_ok(p_user_id)
  ),
  n as (select count(*)::float as total from vault),
  terms as (
    select v.id, l.lex
    from vault v, unnest(tsvector_to_array(v.search_vector)) as l(lex)
    where length(l.lex) > 2 and l.lex !~ '^[0-9]+$'
  ),
  df as (select lex, count(distinct id)::float as d from terms group by lex),
  w as (select t.id, t.lex, ln((select total from n) / df.d) as wt
        from terms t join df on df.lex = t.lex),
  len as (select id, sqrt(sum(wt * wt)) as l from w group by id),
  src as (select v.id, v.project_id from vault v where v.id = p_source_id),
  sib as (
    select v.id from vault v cross join src
    where v.project_id is not null
      and v.project_id = src.project_id
      and v.id <> src.id
  ),
  dot as (
    select wc.id as cand_id, sum(wc.wt * wc.wt) as dp
    from w wc
    join w ws on ws.id = p_source_id and ws.lex = wc.lex
    where wc.id <> p_source_id
    group by wc.id
  ),
  lexical as (
    select s.id,
           coalesce(d.dp / nullif(ls.l * lc.l, 0), 0)::real as affinity
    from sib s
    left join dot d  on d.cand_id = s.id
    left join len lc on lc.id = s.id
    left join len ls on ls.id = p_source_id
  ),
  -- Stage 3: chunk-level MaxSim between the source doc and each same-project candidate.
  -- Deliberately NOT a doc-level centroid (averaging chunk vectors smears a long
  -- document's distinct ideas together — the exact failure this strategy's amendments
  -- already diagnosed for lexical ranking, and embeddings must not repeat it).
  sem as (
    select cand.id,
           -- OPERATOR(extensions.<=>), not bare <=>: a `language sql` function's own
           -- `set search_path` only applies at EXECUTION time, not at CREATE-time body
           -- validation, so a bare <=> fails `42883: operator does not exist` even with
           -- 'extensions' on the search_path (discovered and fixed live in Task 10's
           -- vault_search_documents — the identical operator, the identical function
           -- kind, so this file inherits the same requirement from the start).
           max(1 - (cc.embedding OPERATOR(extensions.<=>) sc.embedding))::real as sem_score
    from sib cand
    join public.document_chunks cc on cc.document_id = cand.id
    join public.document_chunks sc on sc.document_id = p_source_id
    group by cand.id
  ),
  scored as (
    select l.id,
           -- Explicit ::real cast: `real * <numeric literal>` promotes to double
           -- precision in Postgres' operator resolution, and affinity_band(a real)
           -- has no implicit narrowing cast from double precision, which fails
           -- CREATE-time signature resolution with 42883 (reproduced in isolation
           -- via execute_sql before this fix was applied). Casting the whole `case`
           -- expression back to real keeps the value semantically unchanged.
           (case when sem.sem_score is not null
                then (l.affinity * 0.6 + sem.sem_score * 0.4)
                else l.affinity
           end)::real as affinity
    from lexical l
    left join sem on sem.id = l.id
  )
  select c.id, c.filename, c.title, c.file_type, c.word_count,
         c.tags, c.project_id, c.converted_at,
         sc.affinity as rank,
         public.affinity_band(sc.affinity) as strength
  from scored sc
  join public.conversions c on c.id = sc.id
  order by sc.affinity desc
  limit p_max_results;
$$;
