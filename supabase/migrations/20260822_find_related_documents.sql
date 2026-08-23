-- Stage 2c: dual-auth relatedness. find_related_documents mirrors the algorithm from find_related_conversions (20260821_relatedness_project_scoped.sql) with p_user_id replacing auth.uid(); find_related_conversions is redefined as a thin wrapper over it so the algorithm has one copy. Applied live via Supabase MCP.
--
-- WHY, carried forward from 20260821_relatedness_project_scoped.sql so a reader of THIS
-- (now-live) function isn't left guessing:
--
-- RELATEDNESS IS PROJECT MEMBERSHIP, not lexical similarity. Pure lexical matching (the
-- 20260820 approach) let a feature-gating spreadsheet match PM interview transcripts and a
-- broad AI vision doc match an unrelated take-home, because generic business vocabulary is
-- shared by everything in a themed vault — no amount of IDF weighting fixes that. The user
-- already told us which documents belong together (`project_id`) and that curated signal
-- beats any lexical guess; lexical similarity is demoted to "how tightly does it belong"
-- (the affinity_band strong/medium/weak beacon), not "does it belong in the list at all".
--
-- IDF is computed over THIS USER'S vault (the `n`/`df` CTEs here), not globally: 'data' is
-- unremarkable in a PM's vault and highly distinctive in a recipe collection.
--
-- Binary presence, not term frequency (the `dot` CTE sums wc.wt*wc.wt, not raw counts): term
-- frequency is what let one 13,786-word transcript dominate every ranking before this fix.
-- Because wc.wt = ws.wt for a shared lexeme (same term, same IDF), that sum IS the cosine
-- dot product over the IDF-weighted presence vectors — no separate normalization step needed
-- beyond dividing by ls.l * lc.l (the `scored` CTE).
--
-- Unfiled (project_id is null) never matches anything, including another Unfiled doc: "both
-- uncategorised" is not a relationship. That's the `sib` CTE's `v.project_id is not null`
-- guard. A doc alone in its own project therefore returns zero rows on purpose — see this
-- file's Task 2/Step 3 live verification, and the original migration's comment: "most
-- documents genuinely have no related documents; a relatedness feature that always finds
-- something is lying."
--
-- Scope divergence from build_knowledge_graph_v2 (20260822_build_knowledge_graph_v2.sql) is
-- deliberate, not drift: the related-documents panel is project-scoped (this file), the
-- Knowledge Map stays vault-wide on the distinctive-term rule, because cross-project edges
-- are the entire reason to open a map.

create or replace function public.find_related_documents(
  p_user_id uuid,
  p_source_id uuid,
  p_max_results integer default 10
)
returns table(
  id uuid, filename text, title text, file_type text, word_count integer,
  tags text[], project_id uuid, converted_at timestamptz,
  rank real, strength text
)
language sql
stable
set search_path to 'public'
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
  scored as (
    select s.id,
           coalesce(d.dp / nullif(ls.l * lc.l, 0), 0)::real as affinity
    from sib s
    left join dot d  on d.cand_id = s.id
    left join len lc on lc.id = s.id
    left join len ls on ls.id = p_source_id
  )
  select c.id, c.filename, c.title, c.file_type, c.word_count,
         c.tags, c.project_id, c.converted_at,
         sc.affinity as rank,
         public.affinity_band(sc.affinity) as strength
  from scored sc
  join public.conversions c on c.id = sc.id
  order by sc.affinity desc
  limit p_max_results;
$$;

create or replace function public.find_related_conversions(source_id uuid, max_results integer default 10)
returns table(
  id uuid, filename text, title text, file_type text, word_count integer,
  tags text[], project_id uuid, converted_at timestamptz,
  rank real, strength text
)
language sql
stable
set search_path to 'public'
as $$
  select * from public.find_related_documents(auth.uid(), source_id, max_results)
$$;
