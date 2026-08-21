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
-- Four changes: (1) shared, reusable term-building that includes the filename; (2) a
-- WEIGHTED search_vector; (3) length-normalized ranking; (4) a two-part relevance floor —
-- N distinct shared terms AND at least one DISTINCTIVE shared term.
--
-- Why part 4 is not optional: counting shared terms without weighting them by how common
-- they are is nearly always satisfiable. Measured in one real 14-doc vault, 'data' appears
-- in 12 docs, 'free' in 9, 'featur' in 8 — so "shares 2 distinct terms" matched almost every
-- pair, and unrelated docs surfaced on filler vocabulary alone. Requiring one term that
-- appears in at most ~a third of the caller's vault cut 124 candidate pairs to 26 and left
-- 24 of 42 docs correctly showing NOTHING. Most documents have no related documents; a
-- relatedness feature that always finds something is lying.
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
  min_overlap int default 2,
  max_df_ratio real default 0.34
)
returns table (
  id uuid, filename text, title text, file_type text,
  word_count int, tags text[], project_id uuid,
  converted_at timestamptz, rank real
)
language sql stable security invoker
set search_path = public
as $$
  with vault as (
    select c.id, c.search_vector
    from public.conversions c
    where c.user_id = auth.uid() and c.in_vault = true
  ),
  n as (select count(*)::float as total from vault),
  src as (
    select c.title, c.tags, c.filename
    from public.conversions c
    where c.id = source_id and c.user_id = auth.uid()
  ),
  q as (
    select public.relatedness_query(s.title, s.tags, s.filename)   as query,
           public.relatedness_lexemes(s.title, s.tags, s.filename) as lexemes
    from src s
  ),
  -- Document frequency of each source term WITHIN THE CALLER'S OWN VAULT. Global IDF would
  -- be wrong here: 'data' is unremarkable in a PM's vault and highly distinctive in a
  -- recipe collection. Relatedness is relative to the corpus the user actually has.
  df as (
    select l.lex,
           (select count(*) from vault v where l.lex = any (tsvector_to_array(v.search_vector)))::float as d
    from q, unnest(q.lexemes) as l(lex)
  ),
  -- "Distinctive" = appears in at most max_df_ratio of the vault. The greatest(2.0, ...)
  -- floor is load-bearing for small vaults: a SHARED term always has df >= 2 (it is in both
  -- the source and the candidate), so a bare ratio would make every vault under ~6 docs
  -- return nothing, forever. Verified: 7 docs across small vaults still return results.
  rare as (
    select coalesce(array_agg(df.lex), '{}'::text[]) as lexemes
    from df, n
    where df.d <= greatest(2.0, n.total * max_df_ratio)
  )
  select c.id, c.filename, c.title, c.file_type, c.word_count,
         c.tags, c.project_id, c.converted_at,
         -- Normalization flag 2 divides by document length. THIS is the fix for the
         -- long-transcript bias; flag 32 (rank/(rank+1)) keeps the value bounded.
         ts_rank('{0.1,0.2,0.4,1.0}'::float4[], c.search_vector, q.query, 2|32) as rank
  from public.conversions c
  cross join q
  cross join rare
  where c.user_id = auth.uid()
    and c.in_vault = true
    and c.id <> source_id
    and q.query @@ c.search_vector
    -- Part 1 of the floor: enough distinct shared terms.
    and (
      select count(*) from unnest(q.lexemes) l
      where l = any (tsvector_to_array(c.search_vector))
    ) >= least(greatest(min_overlap, 1), cardinality(q.lexemes))
    -- Part 2: at least one of them must actually be distinctive. Note that RAISING
    -- min_overlap without this makes results WORSE, not better -- long documents trivially
    -- share many common terms, so a higher count threshold re-admits exactly the 13k-word
    -- transcripts this migration removes. min_overlap is a noise gate, not a quality dial.
    and exists (
      select 1 from unnest(rare.lexemes) rl
      where rl = any (tsvector_to_array(c.search_vector))
    )
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
  with vault as (
    select c.id, c.search_vector,
           public.relatedness_lexemes(c.title, c.tags, c.filename) as lx,
           public.relatedness_query(c.title, c.tags, c.filename)   as q
    from public.conversions c
    where c.user_id = auth.uid() and c.in_vault = true
  ),
  n as (select count(*)::float as total from vault),
  -- df is computed ONCE over the vault's distinct lexemes, not per source node. Doing it
  -- inside the per-node lateral would make this O(nodes x terms x nodes) on every Map load.
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
    limit max_per_node
  ) t;
$$;

notify pgrst, 'reload schema';
