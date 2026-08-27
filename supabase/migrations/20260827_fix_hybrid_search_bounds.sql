-- Final-review fix (Critical C2): vault_search_documents' semantic arm had no LIMIT, so
-- once the vault is embedded EVERY in-vault document with at least one chunk got a rank
-- for EVERY query. Consequences: (a) a query matching nothing returned the entire vault
-- instead of zero results, (b) total_count became the vault size, breaking the pagination
-- math (hasMore/nextOffset in lib/vault/query.ts's buildPage, and the same numbers
-- surfaced via REST and the search_vault MCP tool), and (c) ts_headline ran for every
-- keyword-matched row before the page LIMIT applied, not just the page returned.
--
-- Two changes:
--   1. semantic_ranked gets `limit greatest(p_limit, 20) * 2`, bounding the candidate pool.
--      RRF is rank-based, not magnitude-based, so it has no natural "no match" concept of
--      its own — the pool has to be bounded explicitly.
--   2. Snippet computation moves out of keyword_ranked and into the final SELECT, after
--      the new `page` CTE applies the LIMIT/OFFSET, so ts_headline (an expensive call —
--      capped input in most cases but still nontrivial) only runs for the rows actually
--      returned. The keyword-vs-semantic branch is preserved via
--      `case when q.tsq @@ s.search_vector then ts_headline(...) else left(markdown, 240) end`,
--      which reproduces the old `coalesce(f.snippet, left(...))` semantics exactly:
--      keyword-matched rows get a highlighted headline, semantic-only rows get the plain
--      text prefix.
--
-- NOT fixed here, deliberately: this bounds the worst case but does NOT restore true
-- "zero results for an irrelevant query" semantics. That needs a similarity-floor
-- threshold, and document_chunks is empty vault-wide today — there is no real embedded
-- data to calibrate a floor against, so any number chosen now would be a guess. Deferred
-- to the live verification step that follows the first real backfill. Note the floor of
-- `greatest(p_limit, 20) * 2` = 40 also exceeds the current 26-document vault, so the cap
-- cannot be observed binding until the vault grows past 40 documents.
--
-- Also NOT addressed here: full HNSW-index utilization. The per-document max() aggregate
-- doesn't map onto a single ANN index scan the way a per-row nearest-neighbour query
-- would. That's a performance follow-up, not a correctness bug this fix needs to solve.
--
-- CREATE OR REPLACE (not drop+recreate): only the body changes, the signature is
-- identical to the Task 10 function, so no ambiguous overload can be created.
-- Applied live via Supabase MCP (migration `fix_hybrid_search_bounds`); this file is a
-- record-only mirror.
--
-- Verified live: the pure-keyword regression ('product manager', limit 5, null embedding)
-- returns the identical document set, order, ranks, snippets and total_count (19) as
-- pre-fix. EXECUTE remains granted to PUBLIC (proacl still contains `=X/postgres`).
-- With synthetic chunks in a rolled-back transaction, semantic-only rows correctly
-- received the plain-text fallback snippet (zero <b> highlights), and a standalone mirror
-- of semantic_ranked over a 26-row pool with `limit 3` kept exactly ranks 1..3 — proving
-- row_number() is computed over the full set before LIMIT trims it.

create or replace function public.vault_search_documents(
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
    -- Bounds the candidate pool: without this, EVERY embedded document gets a rank for
    -- EVERY query (RRF is rank-based, not magnitude-based, so it has no natural "no
    -- match" concept on its own) -- this was Critical finding C2 in the final review.
    -- This bounds the worst case (no more "returns the whole vault") but does NOT by
    -- itself restore true "zero results for an irrelevant query" semantics, which needs a
    -- similarity-floor threshold calibrated against real embedded data.
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
  )
  select
    s.id, s.filename, s.title, s.file_type, s.word_count, s.project_id, s.tags,
    s.source_type, s.converted_at, s.updated_at, s.version,
    p.score::real as rank,
    -- Snippet computation moved here (after the page LIMIT applies, not before) so
    -- ts_headline only runs for the ~20-25 rows actually returned, not every matched row.
    case when q.tsq @@ s.search_vector
      then ts_headline('english', left(coalesce(s.markdown_text, ''), 100000), q.tsq,
                        'MaxFragments=1, MaxWords=40, MinWords=15, ShortWord=3')
      else left(coalesce(s.markdown_text, ''), 240)
    end as snippet,
    (select total from counted) as total_count
  from page p
  join scope s on s.id = p.id
  cross join q
  order by p.score desc;
$$;
