# Connection-on-Save — Implementation Design

**Date:** 2026-06-18
**Status:** Approved design, ready for implementation plan
**Strategy parent:** `~/.claude/plans/users-p-trenkner-documents-master-mdc-p-smooth-stardust.md` (Vault Moat Strategy — this is the "first wedge" of Layer 1, proactive synthesis)

## Context

MDSpin's vault moat is being an *active* vault that reacts the moment knowledge enters, not a
passive Q&A box. Connection-on-save is the first, foundational wedge: when a user saves a
converted doc to their Knowledge Vault, surface the 3–5 most related existing vault docs.

It builds the knowledge graph passively (zero user effort) and creates the relatedness engine
that later Layer-1 features (contradiction flags, synthesis briefs) reuse.

**Decided constraints (from brainstorm):**
- **Method:** lexical full-text (Postgres `tsvector` + `ts_rank`). Entirely in this repo. No
  embeddings, no `mdc-api` change, no API cost. Tag-overlap alone was rejected as too obvious.
- **Surfaces:** two render sites — the Add-to-Vault success screen *and* the vault detail panel.
- **Compute:** on-demand server-side query. No precompute, no stored "related" list, always fresh.

## Why these choices fit the codebase

- Vault docs are one table, `public.conversions` (`markdown_text`, `title`, `tags[]`,
  `project_id`, `in_vault`, `user_id`, `converted_at`…). Related = a query over this table.
- No similarity infra exists today (search is naive `ilike`). pgvector is not enabled and there
  is no AI/embedding SDK in the frontend. The frontend never calls `mdc-api` on save — vault
  writes go straight to Supabase via the browser client under RLS.
- Lexical full-text needs only a Supabase migration + one RPC + one query fn — all in this repo,
  applied via Supabase MCP (project ref `ixdsddfxkrkytiitfici`; migrations are record-only).

## Components

### 1. Schema migration (Supabase MCP; record in `supabase/migrations/`)

Add a generated `search_vector` and index. This also upgrades the existing naive search later.

```sql
alter table public.conversions
  add column if not exists search_vector tsvector
  generated always as (
    to_tsvector('english',
      coalesce(title, '') || ' ' ||
      coalesce(array_to_string(tags, ' '), '') || ' ' ||
      coalesce(markdown_text, '')
    )
  ) stored;

create index if not exists conversions_search_vector_idx
  on public.conversions using gin (search_vector);
```

Generated column backfills existing rows automatically — no separate backfill step.

### 2. RPC — `find_related_conversions(source_id, max_results)`

The single relatedness primitive and the future swap point for embeddings.

```sql
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
    select title, tags from public.conversions
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
         ts_rank(c.search_vector, (select query from q)) as rank
  from public.conversions c, q
  where c.user_id = auth.uid()
    and c.in_vault = true
    and c.id <> source_id
    and (select query from q) @@ c.search_vector
    and ts_rank(c.search_vector, (select query from q)) >= 0.01  -- noise floor; tune
  order by rank desc
  limit max_results;
$$;
```

**Design notes:**
- Query is built from **title + tags** (highest-signal terms), not the whole document — avoids
  noise from a huge markdown body. Tuning lever: append top-frequency markdown terms if recall
  is too low.
- `security invoker` + explicit `auth.uid()` filter ⇒ RLS holds; a user can only ever match
  their own vault docs.
- Min-rank floor (`>= 0.01`) suppresses weak/noisy matches — directly addresses the
  "obvious or noisy" risk. Threshold is a tuning constant.
- Cold start: if a doc has no title and no tags, the query is empty → zero results → UI shows
  nothing (handled below).

### 3. Frontend data fn — `lib/library.ts`

```ts
export interface RelatedSpin {
  id: string
  filename: string
  title: string | null
  file_type: string
  word_count: number | null
  tags: string[]
  project_id: string | null
  converted_at: string
  rank?: number
}

export async function findRelatedSpins(sourceId: string, maxResults = 5): Promise<RelatedSpin[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("find_related_conversions", {
    source_id: sourceId,
    max_results: maxResults,
  })
  if (error) throw error
  return (data ?? []) as RelatedSpin[]
}
```

`RelatedSpin` is a deliberately lighter shape than `Spin` (no `markdown_text`/`in_vault`) — it
matches what the RPC returns and what the list rows render.

### 4. Shared UI — `components/library/related-spins.tsx`

One component, both surfaces.

- **Props:** `sourceIds: string[]`, `onOpen?: (id: string) => void`, optional `className`.
- **Behavior:** fetch `findRelatedSpins` for each source id (usually 1), merge, dedupe by `id`,
  exclude all `sourceIds`, sort by best `rank`, cap at 5.
- **States:** loading → subtle skeleton; empty (0 results) → render `null` (no empty box);
  results → "Related in your Vault" header + clickable rows (title/filename · word count ·
  tag badges).
- **Row click:** if `onOpen` provided, call it (detail panel); else navigate to
  `/app/vault?spin=<id>`.

### 5. Integration site A — Add-to-Vault success screen

In [`components/converter/add-to-vault-panel.tsx`](components/converter/add-to-vault-panel.tsx),
after `addedCount` is set: capture the added `conversionId`s into `addedIds`, render
`<RelatedSpins sourceIds={addedIds} />` directly under the green success banner. No `onOpen` here
— rows deep-link to `/app/vault?spin=<id>`.

### 6. Integration site B — vault detail panel

In [`components/library/spin-detail-panel.tsx`](components/library/spin-detail-panel.tsx), below
the markdown preview, render `<RelatedSpins sourceIds={[spin.id]} onOpen={...} />`. Wire `onOpen`
through the vault page so clicking a related doc switches the open detail panel to that spin.

### 7. Deep-link support (small)

The vault page ([`app/app/vault/page.tsx`](app/app/vault/page.tsx)) reads a `?spin=<id>` query
param on load and opens that spin's detail panel. Enables the save-screen rows to land precisely.

## Out of scope (YAGNI)

Semantic/embedding ranking, contradiction flags, synthesis briefs, weekly digest (later Layer-1
items), and all Layer-2 automation. The RPC contract (`source_id → ranked spins`) is the seam
that keeps the embedding upgrade a drop-in: add a `vector` column, change only the function body.

## Verification (end-to-end)

1. **Apply migration + RPC** via Supabase MCP to ref `ixdsddfxkrkytiitfici`; confirm
   `search_vector` populated on existing rows and the function is callable.
2. **Relevance:** with a vault of ~20 docs, save a new doc that overlaps 2–3 existing ones on
   named entities/topics. Confirm those rank at top and unrelated docs do **not** appear.
3. **Noise/cold start:** a near-empty vault, or a doc with no title/tags, shows **no** Related
   section (not an empty box).
4. **RLS:** confirm the RPC returns only the caller's docs (cannot leak another user's vault).
5. **Both surfaces:** related list renders on the Add-to-Vault success screen and in the detail
   panel; detail-panel click switches the open spin; save-screen click deep-links via `?spin=`.
6. **Run the app** with a manual `npm run dev` and check console/network (Claude_Preview serves
   the git root, not worktrees, per project note).
