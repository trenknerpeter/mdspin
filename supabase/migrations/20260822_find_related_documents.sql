-- Stage 2c: dual-auth relatedness. find_related_documents mirrors the algorithm from find_related_conversions (20260821_relatedness_project_scoped.sql) with p_user_id replacing auth.uid(); find_related_conversions is redefined as a thin wrapper over it so the algorithm has one copy. Applied live via Supabase MCP.

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
