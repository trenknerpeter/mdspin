-- Record-only: applied to hosted project `ixdsddfxkrkytiitfici` via Supabase MCP.
--
-- Supersedes the *scope* of 20260820_relatedness_v2.sql for find_related_conversions.
-- That migration made lexical relatedness as good as lexical relatedness gets, and it still
-- was not good enough: a feature-gating spreadsheet matched PM interview transcripts, and a
-- broad AI vision doc matched an unrelated candidate take-home, because generic business
-- vocabulary is shared by everything in a themed vault. No amount of IDF weighting fixes
-- that; two docs can share five terms with an identical IDF sum and be about nothing alike.
--
-- New basis: RELATEDNESS IS PROJECT MEMBERSHIP. The user already told us which documents
-- belong together, and that curated signal beats any lexical guess. Lexical similarity is
-- demoted from "does this belong in the list" to "how tightly does it belong", i.e. the
-- affinity beacon (strong / medium / weak) rendered next to each result.
--
-- Consequence, and it is intended: a doc that is Unfiled or alone in its project returns
-- ZERO rows and the panel does not render. Most documents genuinely have no related
-- documents. Do not add a vault-wide fallback to "fill" the panel — that reintroduces
-- exactly the cross-topic noise this replaces.
--
-- NOTE ON SCOPE DIVERGENCE: build_knowledge_graph is deliberately left vault-wide on the
-- 20260820 distinctive-term rule. The Map is a different affordance — project-scoped edges
-- would only redraw the clustering its node colours already show, whereas cross-project
-- links are the reason to open a map at all. The panel and the Map therefore use different
-- rules on purpose. Revisit together, not separately.
--
-- Retained from 20260820 and still load-bearing: clean_filename() (baked into the
-- search_vector generated column), relatedness_stopwords(), relatedness_lexemes(),
-- relatedness_query() (all still used by build_knowledge_graph), and the weighted
-- search_vector, which is what this function's IDF weighting reads.

-- Display bucket for the affinity beacon. Thresholds come from the observed range on a real
-- 15-doc vault (0.013 - 0.211): the three tightly-coupled Langdock/MakeOS strategy docs land
-- at 0.095-0.151, the two Plato take-homes at 0.159, and a broad vision doc against its own
-- project siblings at 0.013-0.040. Absolute rather than relative-to-project on purpose --
-- a relative scale would always crown a "strong" result even in a project of unrelated docs.
create or replace function public.affinity_band(a real)
returns text language sql immutable parallel safe
as $$
  select case when a >= 0.15 then 'strong'
              when a >= 0.06 then 'medium'
              else 'weak' end
$$;

-- Return type changes (adds `strength`), so CREATE OR REPLACE is not an option. Drop every
-- prior signature: 20260618/20260619 shipped (uuid,int), 20260820 shipped (uuid,int,int)
-- then (uuid,int,int,real). Leaving any behind makes the named-argument call ambiguous.
drop function if exists public.find_related_conversions(uuid, int, int, real);
drop function if exists public.find_related_conversions(uuid, int, int);
drop function if exists public.find_related_conversions(uuid, int);

create function public.find_related_conversions(
  source_id uuid,
  max_results int default 10
)
returns table (
  id uuid, filename text, title text, file_type text,
  word_count int, tags text[], project_id uuid,
  converted_at timestamptz, rank real, strength text
)
language sql stable security invoker
set search_path = public
as $$
  with vault as (
    select c.id, c.project_id, c.search_vector
    from public.conversions c
    where c.user_id = auth.uid() and c.in_vault = true
  ),
  n as (select count(*)::float as total from vault),
  terms as (
    select v.id, l.lex
    from vault v, unnest(tsvector_to_array(v.search_vector)) as l(lex)
    where length(l.lex) > 2 and l.lex !~ '^[0-9]+$'
  ),
  -- IDF is computed over THIS USER'S vault, not globally: 'data' is unremarkable in a PM's
  -- vault and highly distinctive in a recipe collection.
  df as (select lex, count(distinct id)::float as d from terms group by lex),
  w as (select t.id, t.lex, ln((select total from n) / df.d) as wt
        from terms t join df on df.lex = t.lex),
  len as (select id, sqrt(sum(wt * wt)) as l from w group by id),
  src as (select v.id, v.project_id from vault v where v.id = source_id),
  -- Unfiled (project_id is null) never matches, including against other Unfiled docs:
  -- "both un-categorised" is not a relationship.
  sib as (
    select v.id from vault v cross join src
    where v.project_id is not null
      and v.project_id = src.project_id
      and v.id <> src.id
  ),
  -- Cosine over IDF-weighted binary presence vectors. Binary presence, not term frequency:
  -- frequency is what let a 13,786-word transcript dominate every ranking before.
  -- wc.wt = ws.wt for a shared lexeme (same term, same IDF), so this sum IS the dot product.
  dot as (
    select wc.id as cand_id, sum(wc.wt * wc.wt) as dp
    from w wc
    join w ws on ws.id = source_id and ws.lex = wc.lex
    where wc.id <> source_id
    group by wc.id
  ),
  -- LEFT JOIN, so a sibling sharing nothing still appears at affinity 0 and reads as "weak".
  -- The project asserted the relationship; the beacon only qualifies it.
  scored as (
    select s.id,
           coalesce(d.dp / nullif(ls.l * lc.l, 0), 0)::real as affinity
    from sib s
    left join dot d  on d.cand_id = s.id
    left join len lc on lc.id = s.id
    left join len ls on ls.id = source_id
  )
  select c.id, c.filename, c.title, c.file_type, c.word_count,
         c.tags, c.project_id, c.converted_at,
         sc.affinity as rank,
         public.affinity_band(sc.affinity) as strength
  from scored sc
  join public.conversions c on c.id = sc.id
  order by sc.affinity desc
  limit max_results;
$$;

-- Cost note: this unnests every in-vault tsvector to build the IDF table on each call.
-- Negligible at 15-40 docs, linear in vault size and vocabulary after that. The fix when it
-- bites is a materialised per-user term-frequency table, not a cheaper similarity measure.

notify pgrst, 'reload schema';
