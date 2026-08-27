-- Final-review fix (Critical C1): find_related_documents fed its BLENDED score into
-- affinity_band(), which would have made `strength` read 'strong' for almost every
-- candidate once real chunk data existed.
--
-- Why: gte-small cosine similarity between arbitrary English text pairs sits around
-- 0.7-0.97 (the similarity floor is high — a well-known property of the model), whereas
-- affinity_band()'s 'strong'/'medium' thresholds (0.15/0.06) were calibrated on PURE
-- lexical affinity, whose observed range on a real 15-doc vault was 0.013-0.211 (see
-- 20260821_relatedness_project_scoped.sql's comments for that derivation). The semantic
-- term alone, 0.4 x ~0.9 ~= 0.36, is already 2.4x the 'strong' threshold — so every
-- candidate with chunks would band as 'strong' forever, destroying the one signal
-- (`strength`) the whole relatedness feature exists to provide.
--
-- The fix: keep the blend for ORDERING only (`rank`), and feed the pure, unblended
-- lexical affinity to affinity_band() for the `strength` column. Chosen deliberately over
-- rescaling the blend, because document_chunks is empty vault-wide today — there is no
-- real embedded data to calibrate a rescale factor against, so any constant picked now
-- would be a guess, not a calibration. The cost is that embeddings do not yet UPGRADE the
-- strength label for lexically-silent-but-semantically-related docs (e.g. the
-- numeric-filename docs like 01.txt); that upgrade is deferred, not abandoned, and is
-- unblocked by a live calibration query run against real embedded data after the first
-- backfill.
--
-- CREATE OR REPLACE is safe: signature and return type are unchanged.
-- Applied live via Supabase MCP (migration `fix_relatedness_affinity_calibration`);
-- this file is a record-only mirror.
--
-- Verified live: output is byte-identical to pre-fix (document_chunks is empty, so
-- sem.sem_score is null for every row and blended_rank == l.affinity — a complete no-op
-- today). Additionally proved with synthetic chunks in a rolled-back transaction: a
-- candidate with lexical affinity 0.0338 (band 'weak') and semantic similarity 1.0 moved
-- from rank position 10 to position 1 with rank 0.4203, while `strength` correctly stayed
-- 'weak' — pre-fix that row would have banded 'strong'.

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
  -- document's distinct ideas together -- the exact failure this strategy's amendments
  -- already diagnosed for lexical ranking, and embeddings must not repeat it).
  -- Cost is quadratic in chunk count per candidate pair (O(source_chunks x
  -- candidate_chunks) per candidate) -- fine at current scale (~6 chunks/doc), revisit if
  -- a themed vault's documents grow much larger.
  sem as (
    select cand.id,
           -- OPERATOR(extensions.<=>), not bare <=>: a `language sql` function's own
           -- `set search_path` only applies at EXECUTION time, not at CREATE-time body
           -- validation, so a bare <=> fails 42883 even with 'extensions' on the search_path.
           max(1 - (cc.embedding OPERATOR(extensions.<=>) sc.embedding))::real as sem_score
    from sib cand
    join public.document_chunks cc on cc.document_id = cand.id
    join public.document_chunks sc on sc.document_id = p_source_id
    group by cand.id
  ),
  scored as (
    select l.id,
           l.affinity as lexical_affinity,
           -- `rank`/ordering may benefit from the semantic signal (this is what actually
           -- closes the "numeric-filename docs with no lexical signal" gap Stage 3 exists
           -- to fix), but `strength` MUST stay on pure lexical affinity until a rescale
           -- factor is calibrated against real embedded data (gte-small's similarity floor
           -- for arbitrary text pairs is ~0.7-0.97, wildly out of range for thresholds
           -- tuned on lexical affinity's observed 0.013-0.211 range) -- see the final
           -- whole-branch review's Recommendation 3 (a live calibration query) for the
           -- follow-up that unblocks feeding the blend into affinity_band() safely.
           --
           -- Explicit ::real cast: `real * <numeric literal>` promotes to double
           -- precision in Postgres' operator resolution, and casting the whole `case`
           -- expression back to real keeps the value semantically unchanged.
           (case when sem.sem_score is not null
                 then (l.affinity * 0.6 + sem.sem_score * 0.4)
                 else l.affinity
            end)::real as blended_rank
    from lexical l
    left join sem on sem.id = l.id
  )
  select c.id, c.filename, c.title, c.file_type, c.word_count,
         c.tags, c.project_id, c.converted_at,
         sc.blended_rank as rank,
         public.affinity_band(sc.lexical_affinity) as strength
  from scored sc
  join public.conversions c on c.id = sc.id
  order by sc.blended_rank desc
  limit p_max_results;
$$;
