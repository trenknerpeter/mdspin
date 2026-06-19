-- Fix: find_related_conversions matched almost nothing.
-- websearch_to_tsquery ANDs its terms ('acme & corp & q3 & price & propos'), so a candidate
-- had to contain EVERY word from the source's title+tags — far too strict for "related".
-- Rewrite the query operators to OR ('acme | corp | q3 | ...') so docs sharing ANY significant
-- term match, then rank by ts_rank. (No '&' present => no-op; empty source => empty query => no
-- matches, so cold-start stays safe.)
create or replace function public.find_related_conversions(
  source_id uuid,
  max_results int default 5
)
returns table (
  id uuid, filename text, title text, file_type text,
  word_count int, tags text[], project_id uuid,
  converted_at timestamptz, rank real
)
language sql stable security invoker
set search_path = public
as $$
  with src as (
    select title, tags
    from public.conversions
    where id = source_id and user_id = auth.uid()
  ),
  q as (
    select replace(websearch_to_tsquery('english',
      coalesce((select title from src), '') || ' ' ||
      coalesce((select array_to_string(tags, ' ') from src), '')
    )::text, '&', '|')::tsquery as query
  )
  select c.id, c.filename, c.title, c.file_type, c.word_count,
         c.tags, c.project_id, c.converted_at,
         ts_rank(c.search_vector, q.query) as rank
  from public.conversions c
  cross join q
  where c.user_id = auth.uid()
    and c.in_vault = true
    and c.id <> source_id
    and q.query @@ c.search_vector
  order by rank desc
  limit max_results;
$$;
