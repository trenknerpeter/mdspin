-- Body-only change: same signature, same return type. Two behavioural changes:
-- (1) "siblings" is now "shares ANY project" via document_projects, not equality on
--     the conversions.project_id column (which Phase D will eventually drop) -- this
--     is the "siblings becomes shares any project" consequence the strategy doc's
--     2026-08-21 amendment calls out for the eventual many-to-many migration.
-- (2) the returned project_id is now derived from document_projects (earliest
--     added_at, ties broken by project_id -- same rule as the planned browser-side
--     pickPrimaryProject()), not read from the column -- this fully decouples this
--     function from conversions.project_id ahead of Phase D's drop.
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
  sib as (
    select distinct dp_cand.document_id as id
    from public.document_projects dp_src
    join public.document_projects dp_cand on dp_cand.project_id = dp_src.project_id
    where dp_src.document_id = p_source_id
      and dp_cand.document_id <> p_source_id
      and dp_cand.document_id in (select id from vault)
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
  -- fine at 32 rows (current live count); revisit if the vault grows to the point this
  -- distinct-on becomes a measurable cost per call (same "fine now" caveat pattern as
  -- build_knowledge_graph's known N=500 ceiling, strategy doc Trap 11).
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
