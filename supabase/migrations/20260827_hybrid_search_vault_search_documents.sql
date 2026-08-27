-- Stage 3: vault_search_documents blends keyword ts_rank and chunk cosine similarity via
-- Reciprocal Rank Fusion (RRF, k=60). Dropped and recreated (not CREATE OR REPLACE) because
-- p_query_embedding is a new parameter — see this repo's find_related_conversions
-- precedent for why bare CREATE OR REPLACE would create an ambiguous overload instead.
-- Applied live via Supabase MCP; this file is a record-only mirror.
--
-- Note: the semantic_ranked CTE below uses `OPERATOR(extensions.<=>)` rather than the bare
-- `<=>` cosine-distance operator. Bare `<=>` fails to resolve inside a CREATE FUNCTION body
-- in this project even though `search_path` includes `extensions` and the identical
-- expression resolves fine in a plain SELECT — CREATE FUNCTION analyzes a `language sql`
-- body's operators against the session's search_path at creation time, and the
-- function's own `set search_path` clause only applies at execution time, not at
-- creation/parse time. Schema-qualifying the operator sidesteps that resolution gap.

drop function if exists public.vault_search_documents(uuid, text, uuid, text[], integer, integer);

create function public.vault_search_documents(
  p_user_id uuid,
  p_query text,
  p_project_id uuid default null,
  p_tags text[] default null,
  p_limit integer default 20,
  p_offset integer default 0,
  p_query_embedding extensions.vector(384) default null
)
returns table(id uuid, filename text, title text, file_type text, word_count integer, project_id uuid, tags text[], source_type text, converted_at timestamptz, updated_at timestamptz, version integer, rank real, snippet text, total_count integer)
language sql stable
set search_path to 'public, extensions'
as $$
  with q as (
    select websearch_to_tsquery('english', p_query) as tsq
  ),
  scope as (
    select c.*
    from public.conversions c
    where c.user_id = p_user_id
      and c.in_vault = true
      and public.vault_actor_ok(p_user_id)
      and (p_project_id is null or c.project_id = p_project_id)
      and (p_tags is null or c.tags && p_tags)
  ),
  keyword_ranked as (
    select s.id,
           ts_headline('english', left(coalesce(s.markdown_text, ''), 100000), q.tsq,
                       'MaxFragments=1, MaxWords=40, MinWords=15, ShortWord=3') as snippet,
           row_number() over (
             order by ts_rank('{0.1,0.2,0.4,1.0}'::float4[], s.search_vector, q.tsq, 2|32) desc
           ) as kw_rank
    from scope s, q
    where q.tsq @@ s.search_vector
  ),
  semantic_ranked as (
    select dc.document_id as id,
           row_number() over (
             order by max(1 - (dc.embedding OPERATOR(extensions.<=>) p_query_embedding)) desc
           ) as sem_rank
    from public.document_chunks dc
    join scope s on s.id = dc.document_id
    where p_query_embedding is not null
    group by dc.document_id
  ),
  fused as (
    select coalesce(k.id, sem.id) as id,
           coalesce(1.0 / (60 + k.kw_rank), 0.0) + coalesce(1.0 / (60 + sem.sem_rank), 0.0) as score,
           k.snippet
    from keyword_ranked k
    full outer join semantic_ranked sem on sem.id = k.id
  ),
  counted as (select count(*)::integer as total from fused)
  select
    s.id, s.filename, s.title, s.file_type, s.word_count, s.project_id, s.tags,
    s.source_type, s.converted_at, s.updated_at, s.version,
    f.score::real as rank,
    coalesce(f.snippet, left(coalesce(s.markdown_text, ''), 240)) as snippet,
    (select total from counted) as total_count
  from fused f
  join scope s on s.id = f.id
  order by f.score desc
  limit p_limit offset p_offset;
$$;
