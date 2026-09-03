-- Body-only change: p_project_id now filters by document_projects membership instead
-- of conversions.project_id equality, and the returned project_id column is derived
-- the same "earliest link wins" way as find_related_documents (Task 4), so this
-- function no longer depends on the column at all ahead of Phase D's drop.
create or replace function public.vault_search_documents(p_user_id uuid, p_query text, p_project_id uuid default null::uuid, p_tags text[] default null::text[], p_limit integer default 20, p_offset integer default 0, p_query_embedding vector default null::vector)
returns table(id uuid, filename text, title text, file_type text, word_count integer, project_id uuid, tags text[], source_type text, converted_at timestamp with time zone, updated_at timestamp with time zone, version integer, rank real, snippet text, total_count integer)
language sql
stable
set search_path to 'public, extensions'
as $function$
  with q as (
    select websearch_to_tsquery('english', p_query) as tsq
  ),
  scope as (
    select c.*
    from public.conversions c
    where c.user_id = p_user_id
      and c.in_vault = true
      and public.vault_actor_ok(p_user_id)
      and (p_project_id is null or exists (
        select 1 from public.document_projects dp
        where dp.document_id = c.id and dp.project_id = p_project_id
      ))
      and (p_tags is null or c.tags && p_tags)
  ),
  keyword_ranked as (
    select s.id,
           row_number() over (
             order by ts_rank('{0.1,0.2,0.4,1.0}'::float4[], s.search_vector, q.tsq, 2|32) desc
           ) as kw_rank
    from scope s, q
    where q.tsq @@ s.search_vector
  ),
  semantic_ranked as (
    select dc.document_id as id,
           max(1 - (dc.embedding OPERATOR(extensions.<=>) p_query_embedding)) as sem_score,
           row_number() over (
             order by max(1 - (dc.embedding OPERATOR(extensions.<=>) p_query_embedding)) desc
           ) as sem_rank
    from public.document_chunks dc
    join scope s on s.id = dc.document_id
    where p_query_embedding is not null
    group by dc.document_id
    order by sem_score desc
    limit greatest(p_limit, 20) * 2
  ),
  fused as (
    select coalesce(k.id, sem.id) as id,
           coalesce(1.0 / (60 + k.kw_rank), 0.0) + coalesce(1.0 / (60 + sem.sem_rank), 0.0) as score
    from keyword_ranked k
    full outer join semantic_ranked sem on sem.id = k.id
  ),
  counted as (select count(*)::integer as total from fused),
  page as (
    select f.id, f.score from fused f order by f.score desc limit p_limit offset p_offset
  ),
  -- Same whole-table distinct-on as find_related_documents (Task 4) -- fine at current
  -- scale, same revisit condition.
  primary_project as (
    select distinct on (dp.document_id) dp.document_id, dp.project_id
    from public.document_projects dp
    order by dp.document_id, dp.added_at asc, dp.project_id asc
  )
  select
    s.id, s.filename, s.title, s.file_type, s.word_count, pp.project_id, s.tags,
    s.source_type, s.converted_at, s.updated_at, s.version,
    p.score::real as rank,
    case when q.tsq @@ s.search_vector
      then ts_headline('english', left(coalesce(s.markdown_text, ''), 100000), q.tsq,
                        'MaxFragments=1, MaxWords=40, MinWords=15, ShortWord=3')
      else left(coalesce(s.markdown_text, ''), 240)
    end as snippet,
    (select total from counted) as total_count
  from page p
  join scope s on s.id = p.id
  left join primary_project pp on pp.document_id = s.id
  cross join q
  order by p.score desc;
$function$;
