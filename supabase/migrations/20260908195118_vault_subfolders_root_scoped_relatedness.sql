-- RECORD ONLY. Applied to the hosted Supabase project (ixdsddfxkrkytiitfici) via the
-- Supabase MCP on 2026-09-08; this project has no migration runner.
--
-- Body-only change: same signature, same return type. One behavioural change:
-- "siblings" is now "shares a ROOT project" rather than "shares a project row".
--
-- Why: sub-folders (projects.parent_id) are a filing convenience, but relatedness is a
-- property of the shelf. Splitting a 14-document project into six sub-folders of ~3 would
-- otherwise collapse every document's candidate pool from 13 to 2 -- and do it silently,
-- since an empty panel is a legitimate answer here. Measured on the live vault: with
-- Plato PM split, root-scoped returned 13 and the old project-scoped rule returned 2.
--
-- One level of nesting means ancestry is exactly coalesce(parent_id, id): no recursive CTE.
-- Mirrors rootProjectId() in lib/library.ts -- change both together.
--
-- No-op while nothing is nested (coalesce(null, id) = id), verified by diffing count and
-- rank checksum on the live vault before/after.
--
-- affinity_band's thresholds are unaffected: IDF is computed over the whole vault
-- (n/df/w CTEs), not over the candidate pool, so resizing `sib` moves no affinity value.
-- No recalibration needed (see 20260827_fix_relatedness_affinity_calibration.sql).
create or replace function public.find_related_documents(p_user_id uuid, p_source_id uuid, p_max_results integer default 10)
returns table(id uuid, filename text, title text, file_type text, word_count integer, tags text[], project_id uuid, converted_at timestamp with time zone, rank real, strength text)
language sql
stable
set search_path to 'public, extensions'
as $function$
  with vault as (
    select c.id, c.search_vector
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
  doc_roots as (
    select dp.document_id, coalesce(p.parent_id, p.id) as root_id
    from public.document_projects dp
    join public.projects p on p.id = dp.project_id
  ),
  sib as (
    select distinct cand.document_id as id
    from doc_roots src
    join doc_roots cand on cand.root_id = src.root_id
    where src.document_id = p_source_id
      and cand.document_id <> p_source_id
      and cand.document_id in (select id from vault)
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
  sem as (
    select cand.id,
           max(1 - (cc.embedding OPERATOR(extensions.<=>) sc.embedding))::real as sem_score
    from sib cand
    join public.document_chunks cc on cc.document_id = cand.id
    join public.document_chunks sc on sc.document_id = p_source_id
    group by cand.id
  ),
  scored as (
    select l.id,
           l.affinity as lexical_affinity,
           (case when sem.sem_score is not null
                 then (l.affinity * 0.6 + sem.sem_score * 0.4)
                 else l.affinity
            end)::real as blended_rank
    from lexical l
    left join sem on sem.id = l.id
  ),
  -- Computed over the whole document_projects table, not just this call's candidates --
  -- fine at current row counts; revisit if the vault grows to the point this distinct-on
  -- becomes a measurable cost per call.
  -- Deliberately NOT root-resolved: this is "which folder is this document in", and a
  -- sub-folder is the right answer. Root resolution belongs at display sites only.
  primary_project as (
    select distinct on (dp.document_id) dp.document_id, dp.project_id
    from public.document_projects dp
    order by dp.document_id, dp.added_at asc, dp.project_id asc
  )
  select c.id, c.filename, c.title, c.file_type, c.word_count,
         c.tags, pp.project_id, c.converted_at,
         sc.blended_rank as rank,
         public.affinity_band(sc.lexical_affinity) as strength
  from scored sc
  join public.conversions c on c.id = sc.id
  left join primary_project pp on pp.document_id = c.id
  order by sc.blended_rank desc
  limit p_max_results;
$function$;
