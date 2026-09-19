# History + Knowledge Vault

## Context

Phase 2 step 2. Today every successful conversion is silently written to `conversions` via a
fire-and-forget insert (batch path [use-converter.ts:236](../../../components/converter/use-converter.ts), URL path [:331](../../../components/converter/use-converter.ts)), including
anonymous users (orphan rows with `user_id: null`). The step-1 organization layer (projects,
tags, search, detail panel) was built directly onto that table and the `/app/spins` page.

We are **not** removing auto-save. Instead we split the experience into two co-existing spaces:

- **History** — a complete, automatic, chronological record of everything you've converted. Safe
  to rely on ("what did I convert last week?"). Lives at `/app/history`.
- **Knowledge Vault** — the curated second brain you intentionally build: the step-1 org layer
  (projects/tags/search), showing only items you've explicitly added. Lives at `/app/vault`.

A conversion enters the Vault only via an explicit **"Add to Vault"** action — from the result
screen (the conversion→library retention hook) or from History. This keeps storage frictionless
while making curation deliberate.

Decisions locked during brainstorming:
- Auto-save **stays**, but **only for signed-in users** (drop the anonymous orphan-row inserts).
- Vault membership is **explicit** ("Add to Vault"), not implicit.
- **Two sidebar items**: History and Knowledge Vault.
- Names: **History** (raw log) and **Knowledge Vault** (curated).
- Result-screen "Add to Vault" panel = the option-A inline panel (per-file checklist + project +
  tags), relabeled. No data-loss pressure since history already auto-saved.
- Anonymous "Add to Vault" → preserve result, sign in, resume.
- Rename the per-file/merged **"Save .md" → "Download .md"** (avoid clash with the vault action).

Out of scope: editing titles at add time (rename later in the Vault); per-file project overrides
within a batch (one shared project per batch); semantic search / context packs (later steps).

## Data model

One new column, applied via Supabase MCP + recorded in `supabase/migrations/`:
- `conversions.in_vault boolean not null default false`
- Partial index `(user_id) where in_vault = true` for the Vault query.

Vault = `conversions where in_vault = true`. History = all of the user's `conversions`. The existing
`title` / `project_id` / `tags` columns continue to live on the same row and are only surfaced
once an item is in the Vault. Removing from the Vault sets `in_vault = false` (row stays in History;
project/tags are retained so re-adding restores them).

## Pages & navigation

- **`/app/history`** — **new, simple** list of all conversions (chronological). Per row: copy,
  download, delete, and **Add to Vault**. Rows with `in_vault = true` show an "In Vault" badge
  instead of the add button. This is essentially the pre-step-1 flat list (recoverable from git
  history), reading the full set.
- **`/app/vault`** — the **relocated** step-1 page. Reuse `use-library`, `library-rail`,
  `spin-detail-panel`, `tag-input` unchanged; the only change is the spin query is filtered to
  `in_vault = true`, and the detail panel gains a "Remove from Vault" action.
- **`/app/spins`** — redirect to `/app/history` (closest successor to the old "My Spins = all
  conversions").
- **Sidebar** ([app-sidebar.tsx](../../../components/app-shell/app-sidebar.tsx)): Convert · History · Knowledge Vault · API Keys · Settings.

## "Add to Vault" mechanics

- **Signed-in:** auto-save still inserts the conversion row, but now **captures the returned id**
  onto the `FileItem` (await the insert instead of pure fire-and-forget). "Add to Vault" is then an
  **update** of those rows: `in_vault = true` + chosen `project_id` + `tags`. No duplicate rows.
- **Anonymous:** no auto-save (no owning account). "Add to Vault" stashes
  `{files, tags, createdAt}` in `localStorage` (`mdspin:pendingVaultAdd`, ~2 MB cap, 1-hour TTL),
  triggers `onAuthRequired` (sign-in, `next=/app`). On the next signed-in converter mount,
  `resumePendingVaultAdd` rehydrates the result (`batchStatus='done'`) and reopens the panel;
  saving **inserts** the rows with `in_vault = true` + project/tags (one write → lands in History
  and Vault).

## Components

1. **`lib/library.ts`** (extend):
   - `buildConversionRows(files, { projectId, tags }, userId)` — **pure**, builds insert rows with
     `in_vault: true`. Unit-testable.
   - `insertVaultConversions(files, { projectId, tags })` — anon resume path (insert + in_vault).
   - `addToVault(ids, { projectId, tags })` — signed-in path (update existing rows by id).
   - `removeFromVault(id)` — sets `in_vault = false`.
   - `listHistory({ query, from, to })` — all conversions (for History page).
   - `listSpins` gains `inVault?: boolean` → Vault passes `true`.
2. **`components/converter/add-to-vault-panel.tsx`** (new) — the result-screen panel: file
   checklist (default all), project select (with inline "+ New project" via `createProject`), tag
   input, "Add N to Vault" → "Added ✓ · View in Vault". Signed-in vs anonymous variants (anon =
   single "Sign in to add to your Vault" CTA that stashes + calls `onAuthRequired`).
3. **`components/converter/use-converter.ts`** — capture insert ids on auto-save (signed-in only);
   stop inserting for anonymous; add stash + `resumePendingVaultAdd`; expose successful files +
   their conversion ids + a resume signal to the panel.
4. **`components/converter/converter.tsx`** — render the panel at the top of results; rename
   "Save .md" → "Download .md" (per-file + merged).
5. **`app/app/history/page.tsx`** (new), **`app/app/vault/page.tsx`** (moved from `spins`),
   **`app/app/spins/page.tsx`** → redirect.

## Error handling

- `addToVault` / `insertVaultConversions` failure → inline panel error, items stay un-added, button
  re-enabled. Single batched call — no partial-success ambiguity.
- Auto-save id capture failure → the row still exists (best-effort); "Add to Vault" from the result
  screen falls back to insert-if-no-id. Never blocks showing results.
- Stash quota exceeded / corrupt JSON / stale → swallow, ignore, clear; never throw on mount.

## Testing / Verification

**Local blocker:** the dev `.env` backend key isn't production, so conversions can't run locally;
the result-screen panel only appears post-conversion. Therefore:
- **Unit test (Vitest, `lib/__tests__/library-rows.test.ts`)**: `buildConversionRows` — correct
  rows, selected subset only, shared project/tags, null project, skips failed/empty files,
  `in_vault: true`.
- **Build/type**: `npm run build` + `npx tsc --noEmit` clean.
- **Local (no backend) checks**: History and Vault pages render; `/app/spins` redirects; sidebar
  shows both; seed rows (some `in_vault = true`) show correctly split between History and Vault;
  "Add to Vault" from a History row promotes it (moves into Vault, badge flips); "Remove from
  Vault" works.
- **End-to-end on a deployed env** (real backend): convert (signed in) → auto-appears in History →
  Add to Vault with project + tags → appears in Vault; deselect a file → not added; anon convert →
  Add to Vault → sign in → result resumes → added; confirm no anonymous rows are written.

## Critical files

- `supabase/migrations/<date>_conversion_in_vault.sql` — new (also applied via MCP).
- `lib/library.ts` — extend (vault add/remove, history list, in_vault filter, pure row builder).
- `components/converter/add-to-vault-panel.tsx` — new.
- `components/converter/{use-converter.ts,converter.tsx}` — id capture, anon stash/resume, panel, rename.
- `app/app/history/page.tsx` (new), `app/app/vault/page.tsx` (moved), `app/app/spins/page.tsx` (redirect).
- `components/app-shell/app-sidebar.tsx` — two nav items.
- `lib/__tests__/library-rows.test.ts` — new.

## Commit

Per project memory: commit directly to `main`. Frontend + one additive Supabase column — no
`mdc-api` deploy dependency.
