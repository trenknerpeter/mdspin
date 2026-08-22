-- Stage 2c: ranked full-text search with a snippet + score. The new capability list_documents/direct table access cannot provide — see the strategy doc's search_vault MCP tool spec.

create or replace function public.vault_search_documents(
  p_user_id uuid,
  p_query text,
  p_project_id uuid default null,
  p_tags text[] default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table(
  id uuid, filename text, title text, file_type text, word_count integer,
  project_id uuid, tags text[], source_type text, converted_at timestamptz,
  updated_at timestamptz, version integer,
  rank real, snippet text, total_count integer
)
language sql
stable
set search_path to 'public'
as $$
  with q as (
    select websearch_to_tsquery('english', p_query) as tsq
  ),
  scope as (
    select c.*
    from public.conversions c, q
    where c.user_id = p_user_id
      and c.in_vault = true
      and public.vault_actor_ok(p_user_id)
      and (p_project_id is null or c.project_id = p_project_id)
      and (p_tags is null or c.tags && p_tags)
      and q.tsq @@ c.search_vector
  ),
  counted as (
    select count(*)::integer as total from scope
  )
  select
    s.id, s.filename, s.title, s.file_type, s.word_count,
    s.project_id, s.tags, s.source_type, s.converted_at, s.updated_at, s.version,
    ts_rank('{0.1,0.2,0.4,1.0}'::float4[], s.search_vector, q.tsq, 2|32) as rank,
    ts_headline('english', left(coalesce(s.markdown_text, ''), 100000), q.tsq,
                'MaxFragments=1, MaxWords=40, MinWords=15, ShortWord=3') as snippet,
    (select total from counted) as total_count
  from scope s, q
  order by rank desc
  limit p_limit offset p_offset;
$$;
