# Vault Subprojects — Folder-First Vault, One Level of Nesting

**Date:** 2026-09-08 (shipped 2026-09-08 – 2026-09-09)
**Status:** Shipped
**Builds on:** [History + Knowledge Vault](2026-06-16-history-and-knowledge-vault-design.md) (original flat project model), Stage 5 (`document_projects` many-to-many join, `primaryProjectId()` convention).

## Context

At 28 documents across 6 projects, `/app/vault` showed every document as one row
in a single flat list — no grouping anywhere in the codebase. One project,
"Plato PM," held half the vault (14 of 28 docs) with an obvious latent
structure inside it (one cluster per hiring candidate); the other five
projects held 1–5 docs each, where sub-folders would be empty ceremony.

The ask: make the vault read as folders, and let the one project that outgrew
a single level split one level deeper — without weakening the
relatedness/graph intelligence already built on top of project membership.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Landing view | Grid of project cards (+ Unfiled); list is a `?view=list` toggle | 6 cards read better than 28 rows |
| Doc membership | Exactly one home per doc; tags carry cross-cutting links | Already the runtime truth — see below |
| Depth | Exactly one level (project → **subproject** → docs) | Nothing in the real vault needs more; Plato PM's candidates fit one level |
| Related docs after a split | Scope to the **top-level (root) project**, not the subproject | Splitting a project must never shrink its candidate pool |
| Filing the backlog | Multi-select + bulk move | One-at-a-time would mean 13+ open-select-save cycles |
| Terminology | **"subproject"**, never "subfolder" — UI, MCP descriptions, DB guard messages | The one exception: the ingest panel's "subfolders → tags" really does mean filesystem folders |

### The finding that made this cheap

Stage 5 added a `document_projects` many-to-many join table, which looks like
it conflicts with "one home per doc." It doesn't: every write path still goes
through the singular `conversions.project_id`, mirrored into
`document_projects` by a `FOR EACH ROW` sync trigger
(`conversions_sync_document_projects`, delete-all-then-insert-one). So "exactly
one home" was already the runtime truth — no migration to undo, no trigger to
drop. The data-model change was a single nullable column.

## Schema

Applied directly to the hosted Supabase project (`ixdsddfxkrkytiitfici`) via
the Supabase MCP — this project has no migration runner, so
`supabase/migrations/*.sql` is a record-only copy, applied in this order:

1. `20260908195003_vault_subfolders_projects_parent_id.sql` — `projects.parent_id`
   (composite FK on `(parent_id, user_id)` against the existing
   `unique (id, user_id)`, so a project can't be parented under another user's —
   FK checks bypass RLS, so `user_id` has to be *in* the key, not just enforced
   by a policy). Depth is capped at one level by a `SECURITY DEFINER` trigger
   (a `CHECK` can't look at another row). The definer is load-bearing: a plain
   trigger reading `projects` is itself subject to RLS, so a cross-tenant
   `parent_id` would return *no row* — which reads as "parent has no parent,
   therefore it's a root" and gets silently accepted. Six guards proven live:
   one level allowed; grandchild, self-parent, demoting-a-parent-with-children,
   and cross-tenant parenting all rejected; deleting a root cascades its
   subprojects (docs fall to Unfiled via the existing `ON DELETE SET NULL`).
2. `20260908195118_vault_subfolders_root_scoped_relatedness.sql` —
   `find_related_documents`'s `sib` CTE redefined from "shares a project row" to
   "shares a **root** project" (`coalesce(parent_id, id)` on both sides). Body-only
   change, same signature. No-op while nothing is nested.
3. `20260908195304_vault_subfolders_search_subtree.sql` —
   `vault_search_documents`'s `p_project_id` filter matches a project **or its
   subprojects**.
4. `20260908195322_vault_subfolders_stats_count_roots.sql` — `vault_stats.project_count`
   counts roots, so splitting one project doesn't inflate the number a user sees
   (6 → 11 would otherwise happen silently).
5. `20260908203000_vault_subprojects_rename_guard_message.sql` — terminology-only:
   the depth-guard's error text says "subproject," matching the UI. `lib/vault/repo.ts`'s
   `projectParentError()` matches on this exact text to turn the raise into a
   readable `INVALID_REQUEST` instead of a raw `DB_ERROR` → 500 — the two must
   change together.

**The Knowledge Map needed no SQL change.** `build_knowledge_graph_v2` returns
edges only; node colour is computed in `lib/graph.ts`. Root-scoping the colour
(so a split project stays one visual community) is TypeScript-only — see
below. Fixed a latent bug alongside it: the fallback palette was indexed over
*all* projects, so creating a single subproject would have silently
re-coloured unrelated nodes. A test (`graph.test.ts`) fails without the fix.

### Verification pattern

Every live-database check ran inside a `do $$ ... $$` block ending in `raise
exception` carrying the measurements — the exception rolls the whole thing
back, so real data is never touched, and the numbers come out in the error
message. Example, the load-bearing check:

```sql
raise exception 'root_scoped=% old_project_scoped=%', root_scoped, same_folder_only;
-- ERROR: MEASURED root_scoped=13 old_project_scoped=2
```

With Plato PM actually split into subprojects: related docs stayed at 13
under the new rule vs. 2 under the old one; search filtered by the root stayed
at 11; `project_count` stayed at 6; a bulk move of 3 docs left exactly 3
`document_projects` links and 0 stale links to the old parent.

## Application layer

- **`lib/library.ts`**: `Project.parent_id`; `rootProjectId()`, `descendantProjectIds()`,
  `rollUpProjectCounts()`, `projectPath()` — all pure, all one lookup (nesting is
  one level, never a walk). `listSpins` takes a caller-resolved `descendantIds`
  so selecting a root shows its subprojects' documents while the data layer
  stays tree-unaware. `moveSpinsToProject()` and `idsInRange()` (shift-click
  range selection) back the bulk-move feature.
- **`components/library/library-rail.tsx`**: one-level tree with disclosure
  triangles, tree connectors (a continuous trunk with a `└` elbow per child —
  first attempt was broken dashes because `space-y-0.5` between rows punched
  gaps through the line), rolled-up counts on roots. Subprojects drop the
  colour swatch (the parent's colour already identifies the group). Actions
  moved from three inline hover icons to a single kebab menu, styled in the
  app's own language (accent-at-12% highlight, Syne micro-label header,
  cooler red for Delete) rather than shadcn's stock grey/red-400.
- **`components/library/folder-grid.tsx` / `folder-card.tsx`**: the vault
  landing page — one card per top-level project (+ Unfiled), doc count, last
  activity, subproject chips, recent titles.
- **`components/library/vault-list-view.tsx`**: extracted from `page.tsx` so
  the grid, drill-in, and `?view=list` share one implementation. Gained
  checkbox-per-row multi-select (shift-click for a range), a sticky bulk
  action bar ("N selected · Select all · Move to… · Clear"), and a project
  chip that now reads the full path ("Plato PM / Faiaz") with the swatch
  colour pulled from the root rather than the (always-null) subproject colour.
- **`components/library/spin-detail-panel.tsx`**, **`add-to-vault-panel.tsx`**:
  project `<select>` groups subprojects under their parent via `<optgroup>`;
  value stays a scalar id, so no write path changed.
- **Color picker**: the browser had no way to set `projects.color` at all —
  confirmed on the live DB, every project's `color` was `null`. MCP could
  always set it; the rail couldn't. Added a "Change color" kebab item
  (root projects only — a subproject never renders its own swatch anywhere,
  so a picker there would set a value nothing shows) opening an 8-swatch
  preset grid.
- **MCP + REST**: `parent_id` exposed on `create_project`/`update_project`/
  `list_projects`/`get_project`; `get_project` lists subprojects inline;
  `?project_id=` on `/documents` and `/search` is subtree-inclusive by
  default; bad nesting maps to `INVALID_REQUEST`, not a 500.

## A shared-primitive bug found via this work

`components/ui/dropdown-menu.tsx`'s `DropdownMenuSubContent` was never wrapped
in a `Portal`, unlike its own `DropdownMenuContent` right above it. The parent
menu's open/close zoom animation leaves a non-`"none"` CSS `transform` on it,
which (per spec) creates a new containing block for `position: fixed`
descendants — so an unportaled submenu ends up positioned relative to, and
clipped by, the parent's own `overflow-hidden` box. Every computed style
still reports `data-state="open"`, `opacity: 1`, `visibility: visible`; the
content is just off in a region you can't see. A first verification pass
missed this because it disabled all CSS animations before opening the menu,
which happened to also remove the transform that causes the bug — real mouse
hover reproduced it immediately. Fixed by portaling `DropdownMenuSubContent`,
which protects every current and future Radix submenu in the app, not just
the color picker.

## Testing / Verification

- 546 unit tests (vitest), `npm run build` clean, at every commit in the range.
- Every SQL change proven against the **live** database inside aborted
  transactions (see pattern above) — schema guards, no-op-while-flat, and
  behaviour under a real split, never against a synthetic fixture.
- UI verified against temporary fixture harnesses (deleted after each check,
  never committed) using real browser mouse/keyboard interaction — not
  dispatched synthetic events, which is exactly what let the submenu bug
  through the first time.

## Critical files

- `lib/library.ts`, `lib/graph.ts`, `lib/vault/repo.ts`, `lib/vault/types.ts`, `lib/mcp/tools/projects.ts`, `lib/mcp/format.ts`
- `components/library/{use-library,library-rail,folder-grid,folder-card,vault-list-view,spin-detail-panel}.tsx`
- `components/ui/dropdown-menu.tsx`
- `supabase/migrations/20260908*.sql` (record-only; live schema is on the hosted project)

## Deferred

Per-project AI summaries on the folder cards — needs new LLM plumbing (closest
existing pattern: the cluster-brief route + its Make scenario). Not started.

## Commits

`789514d`, `7c62c9a`, `5b16036`, `87e638f`, `20bcfd9`, `3c71f9f`, `695daf3`,
`7689911`, `2ba4a84`.

