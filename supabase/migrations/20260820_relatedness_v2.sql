-- Record-only: applied to hosted project `ixdsddfxkrkytiitfici` via Supabase MCP.
--
-- Fixes "Related in your Vault" returning nonsense.
--
-- The bug: find_related_conversions built its tsquery from `title + tags` only. 30 of 41
-- in-vault docs have a NULL title (the UI shows `filename` as a *placeholder*), so for most
-- docs the query collapsed to its tags — for the doc that surfaced this, the single lexeme
-- 'data'. Candidates were then ranked by ts_rank with NO length normalization, so term
-- frequency won and the longest documents floated to the top. Observed scores for the five
-- results: 0.0980 / 0.0977 / 0.0975 / 0.0974 / 0.0969 — indistinguishable noise. The panel
-- effectively read "your five longest docs that mention 'data'". 21 docs have neither title
-- nor tags and therefore returned nothing at all.
--
-- `filename` was in neither the query nor search_vector, so it was invisible to relatedness.
--
-- Three changes: (1) shared, reusable term-building that includes the filename; (2) a
-- WEIGHTED search_vector; (3) length-normalized ranking plus a distinct-lexeme-overlap floor.
--
-- Stage 2c of the Cloud Knowledge Hub plan (find_related_documents / build_knowledge_graph_v2,
-- taking an explicit p_user_id) MUST call relatedness_query()/relatedness_lexemes() rather
-- than rebuilding term construction, and MUST pass the same weight array + normalization.

-- ---------------------------------------------------------------------------
-- 1. Reusable helpers
-- ---------------------------------------------------------------------------

-- Strip the extension and turn separators into spaces, so `Free-to-Paid_Gating.pdf`
-- tokenizes as words. Immutable: it is used inside a generated column.
create or replace function public.clean_filename(fn text)
returns text language sql immutable parallel safe
as $$
  select regexp_replace(
           regexp_replace(coalesce(fn, ''), '\.[A-Za-z0-9]{1,5}$', ''),
           '[_\-/\.]+', ' ', 'g')
$$;

-- Tokens that say nothing about what a document is ABOUT: file extensions and the
-- boilerplate that meeting-note exporters bake into filenames. Stored as raw words and
-- run through to_tsvector so the stoplist is stemmed the same way the corpus is
-- ('notes' -> 'note', 'challenge' -> 'challeng'); comparing raw words against stemmed
-- lexemes would silently match nothing.
create or replace function public.relatedness_stopwords()
returns text[] language sql immutable parallel safe
as $$
  select tsvector_to_array(to_tsvector('english',
    'pdf docx doc md markdown txt rtf notes gemini online cest cet challenge '
    'interview meeting transcript untitled copy final draft version'))
$$;

-- The single source of truth for "what is this document about": distinct, stemmed,
-- de-junked lexemes drawn from title + tags + filename.
create or replace function public.relatedness_lexemes(
  p_title text, p_tags text[], p_filename text
) returns text[] language sql immutable parallel safe
as $$
  select coalesce(array_agg(distinct t.lex order by t.lex), '{}'::text[])
  from (
    select unnest(tsvector_to_array(to_tsvector('english',
      coalesce(p_title, '') || ' ' ||
      public.tags_to_text(p_tags) || ' ' ||
      public.clean_filename(p_filename)
    ))) as lex
  ) t
  where length(t.lex) > 1              -- single characters carry no signal
    and t.lex !~ '^[0-9]+$'            -- bare numbers and years (2026, 202509)
    and not (t.lex = any (public.relatedness_stopwords()))
$$;

-- OR-joined tsquery over those lexemes. A doc sharing ANY significant term is a candidate;
-- the overlap floor below, not the query, decides what actually counts as related.
-- Empty source => NULL tsquery => `@@` is NULL => no rows. Cold start stays safe.
create or replace function public.relatedness_query(
  p_title text, p_tags text[], p_filename text
) returns tsquery language sql immutable parallel safe
as $$
  select nullif(
    (select string_agg(quote_literal(l), ' | ')
       from unnest(public.relatedness_lexemes(p_title, p_tags, p_filename)) l),
    '')::tsquery
$$;

-- ---------------------------------------------------------------------------
-- 2. Weighted search_vector, now including the filename
-- ---------------------------------------------------------------------------
-- A = title + tags + filename (what the doc IS), D = body (what it mentions in passing).
-- With ts_rank's default {0.1,0.2,0.4,1.0} weights an A hit counts 10x a D hit.
--
-- SET EXPRESSION rather than DROP + ADD COLUMN: there are 24 live users and no reason to
-- expose a window where the column and its GIN index don't exist. Rewrites the table
-- (trivial at 196 rows) and rebuilds conversions_search_vector_idx.
--
-- NOTE: `summary` deliberately stays OUT of this vector — it derives from markdown_text,
-- so including it would double-weight the same terms and skew every ts_rank. `filename`
-- is safe because it is genuinely new information, present nowhere else in the vector.
alter table public.conversions
  alter column search_vector set expression as (
    setweight(to_tsvector('english',
      coalesce(title, '') || ' ' ||
      public.tags_to_text(tags) || ' ' ||
      public.clean_filename(filename)
    ), 'A') ||
    setweight(to_tsvector('english', left(coalesce(markdown_text, ''), 100000)), 'D')
  );

-- ---------------------------------------------------------------------------
-- 3. find_related_conversions
-- ---------------------------------------------------------------------------
-- DROP first: adding min_overlap changes the signature, and CREATE OR REPLACE would leave
-- the 2-arg version in place as an overload, making the existing named-argument call
-- ({source_id, max_results}) ambiguous to PostgREST. Return shape is otherwise unchanged so
-- lib/library.ts findRelatedSpins and app/api/brief/route.ts need no edits.
drop function if exists public.find_related_conversions(uuid, int);

create function public.find_related_conversions(
  source_id uuid,
  max_results int default 5,
  min_overlap int default 2
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
    select c.title, c.tags, c.filename
    from public.conversions c
    where c.id = source_id and c.user_id = auth.uid()
  ),
  q as (
    select public.relatedness_query(s.title, s.tags, s.filename)  as query,
           public.relatedness_lexemes(s.title, s.tags, s.filename) as lexemes
    from src s
  )
  select c.id, c.filename, c.title, c.file_type, c.word_count,
         c.tags, c.project_id, c.converted_at,
         -- Normalization flag 2 divides by document length. THIS is the fix for the
         -- long-transcript bias; flag 32 (rank/(rank+1)) keeps the value bounded.
         ts_rank('{0.1,0.2,0.4,1.0}'::float4[], c.search_vector, q.query, 2|32) as rank
  from public.conversions c
  cross join q
  where c.user_id = auth.uid()
    and c.in_vault = true
    and c.id <> source_id
    and q.query @@ c.search_vector
    -- Relevance floor: share at least N DISTINCT source terms. Absolute ts_rank values
    -- under normalization 2 land around 1e-5 and are far too unstable to threshold on;
    -- distinct-term overlap is stable, explainable, and independent of document length.
    and (
      select count(*) from unnest(q.lexemes) l
      where l = any (tsvector_to_array(c.search_vector))
    ) >= least(greatest(min_overlap, 1), cardinality(q.lexemes))
  order by rank desc
  limit max_results;
$$;

-- ---------------------------------------------------------------------------
-- 4. build_knowledge_graph — same construction, so Map and detail panel agree
-- ---------------------------------------------------------------------------
-- Return type unchanged, so CREATE OR REPLACE is fine here.
-- Known scaling edge (unchanged in kind, slightly costlier per node): this runs one ranked
-- search per in-vault doc on every Map load. Fine at 41 nodes; revisit at ~500.
create or replace function public.build_knowledge_graph(max_per_node int default 5)
returns table (source_id uuid, target_id uuid, weight real)
language sql stable security invoker
set search_path = public
as $$
  select s.id as source_id, t.id as target_id, t.rank as weight
  from public.conversions s
  cross join lateral (
    select c.id, ts_rank('{0.1,0.2,0.4,1.0}'::float4[], c.search_vector, q.query, 2|32) as rank
    from public.conversions c
    cross join (
      select public.relatedness_query(s.title, s.tags, s.filename)  as query,
             public.relatedness_lexemes(s.title, s.tags, s.filename) as lexemes
    ) q
    where c.user_id = auth.uid()
      and c.in_vault = true
      and c.id <> s.id
      and q.query @@ c.search_vector
      and (
        select count(*) from unnest(q.lexemes) l
        where l = any (tsvector_to_array(c.search_vector))
      ) >= least(2, cardinality(q.lexemes))
    order by rank desc
    limit max_per_node
  ) t
  where s.user_id = auth.uid()
    and s.in_vault = true;
$$;

notify pgrst, 'reload schema';
