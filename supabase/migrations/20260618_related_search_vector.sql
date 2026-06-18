-- Connection-on-save: full-text relatedness over the vault.
-- Immutable helper so the generated column expression qualifies.
create or replace function public.tags_to_text(tags text[])
returns text language sql immutable parallel safe
as $$ select coalesce(array_to_string(tags, ' '), '') $$;

-- search_vector is generated from title + tags + markdown (capped at 100k chars to stay
-- within Postgres tsvector 1 MB limit for large documents).
alter table public.conversions
  add column if not exists search_vector tsvector
  generated always as (
    to_tsvector('english',
      coalesce(title, '') || ' ' ||
      public.tags_to_text(tags) || ' ' ||
      left(coalesce(markdown_text, ''), 100000)
    )
  ) stored;

create index if not exists conversions_search_vector_idx
  on public.conversions using gin (search_vector);

-- Rank the caller's OTHER in-vault docs against the source doc's title+tags.
-- security invoker + auth.uid() filter => RLS holds; never matches another user's docs.
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
    select websearch_to_tsquery('english',
      coalesce((select title from src), '') || ' ' ||
      coalesce((select array_to_string(tags, ' ') from src), '')
    ) as query
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
