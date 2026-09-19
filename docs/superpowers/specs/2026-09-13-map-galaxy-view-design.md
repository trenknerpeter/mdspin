# Knowledge Map → Galaxy view (visual layer, no AI)

## Context

`/app/vault/map` has been rebuilt twice in two days. First as a force-directed graph of
relatedness edges (the original state) — deleted because every numeric relatedness signal
measured against the live vault (lexical `ts_rank`, chunk-embedding MaxSim, IDF body terms)
failed to discriminate; see `project_vault_relatedness_v2` in memory. Then, same investigation,
as an LLM-adjudicated "what connects to this project?" lens — built end-to-end (schema, Make
scenario, routes, UI), tested against real vault data, and reversed the same day: Peter decided
the Map should not be an analysis feature at all.

**What the Map is now:** a pure spatial/visual layer over the Vault's existing structure. Vault =
galaxy, root projects = planets, subprojects = moons orbiting their planet, documents = stars.
Zoom in on a project to see what's inside it. No relatedness, no LLM, no Make, no "connections,"
no strength badges — just the shape of the vault, rendered.

## Decisions (this session)

- **Discrete drill-down**, not continuous pan/zoom: click a planet → its scene (moons + its own
  documents) replaces the galaxy view; a breadcrumb lets you jump back to any level. Chosen over
  a real zoom camera because it's simpler to get right and matches how Folders already works
  (click in, click back) — no precedent elsewhere in the app for continuous zoom, several ways
  for it to go wrong (label legibility, performance, disorientation).
- **Scattered cluster** layout, not concentric orbital rings — organic positions sized by
  document count, closer to an actual night-sky image. Confirmed against a live side-by-side
  mockup (`public/mockups/galaxy-v1.html`, to be deleted before shipping).
- **Documents render as plain dots**, no on-canvas titles — a title only on hover/click. Keeps
  a 14-document project (Plato PM, today's largest) legible; an on-canvas label for every dot
  would not scale.
- **Unfiled is a visible "asteroid cluster"** at the galaxy's edge — dim, unlabeled-until-hover,
  not orbiting anything, drilling into it like any other project-shaped bucket. Not hidden: an
  unfiled document should still be visible in the one view meant to show the whole vault.
- **Clicking a document navigates directly** to `/app/vault?spin=<id>` (already honored by the
  vault page's mount effect) — consistent with every other document link in the app.
- **A lightweight search/jump box** stays in scope — type a project or document name, it locates
  and drills to it. This is wayfinding over existing structure, not analysis, so it doesn't
  conflict with "no AI features."
- **Plain SVG**, not Canvas, not a charting/graph library. The scene is at most a few dozen
  planets/moons plus up to a few hundred document dots — SVG gives native click/hover/a11y for
  free at this scale, with no physics simulation to run (unlike the deleted force-directed
  graph — this is a fixed, computed layout, not a simulation).

## Data

No new tables, no new API routes. Reuses exactly what the Folders grid already fetches:

- `listProjects()` (`lib/library.ts`) — all projects, with `parent_id`/`color`.
- `listFolderRows()` + `computeFolderSummaries()` (`lib/library.ts`) — per-project document
  counts and `lastActivity`, already rolled up including subprojects.
- On drilling into a specific project/subproject only: a scoped fetch of that folder's documents
  (`id, title, filename, file_type`) — the galaxy view itself never loads every document in the
  vault, only the currently-open level's.

## Layout algorithm

Positions must be **deterministic** (the same project lands in the same place every load — a
galaxy that reshuffles on refresh is disorienting) but not hand-authored, since project count and
membership changes over time.

Pure function, unit-tested, no I/O:

```ts
// lib/vault/galaxy-layout.ts
function hashPosition(id: string, seed: string): { x: number; y: number }   // stable pseudo-random [0,1]×[0,1]
function relaxCollisions(nodes: { x, y, r }[], bounds): { x, y, r }[]        // pushes overlapping circles apart, deterministic iteration order
function layoutGalaxy(projects: Project[], summaries: FolderSummary[]): PlanetLayout[]
function layoutProjectScene(project, subprojects, documents): SceneLayout    // moons on a ring, documents scattered further out via the same hash+relax approach
```

`hashPosition` uses the project/document id as the hash seed so a given id always resolves to the
same starting coordinate; `relaxCollisions` is a fixed small number of iterations (not a physics
sim run to convergence) so it terminates in constant time regardless of vault size.

## Interaction model

- **Galaxy (level 1):** all root projects as planets (size ∝ document count including
  subprojects, color = project's own color or the existing neutral fallback), plus the Unfiled
  asteroid cluster. Click a planet → level 2. Search box locates a project or document by name
  and jumps directly to the right level.
- **Project (level 2):** the clicked project centered and enlarged; its subprojects as moons on a
  faint orbit ring; its own directly-filed documents as small dots scattered around. Breadcrumb:
  `Galaxy / {Project}`. Click a moon → level 3. Click a document dot → navigate to it. Click
  "Galaxy" in the breadcrumb → back to level 1.
- **Subproject (level 3):** that subproject's own documents as dots. Breadcrumb:
  `Galaxy / {Project} / {Subproject}`.
- **Unfiled:** same level-2-shaped scene (no moons, just its documents as dots), reached by
  clicking the asteroid cluster from the galaxy.

## Visual design

- Background starfield: a fixed number of small dim dots, positioned once (same hash approach,
  seeded independently of real data) — pure atmosphere, not data.
- Planet/moon size: proportional to document count (a project's own docs plus, for a planet, its
  subprojects' rolled-up count), same `computeFolderSummaries`/`rollUpProjectCounts` numbers the
  Folders grid already computes — not a separate calculation.
- Planet color: the project's own root color if set, else the existing neutral fallback
  (`#4A4A46`) already used everywhere else color falls back — no new palette.
- Glow: a radial gradient behind each planet/moon, not a CSS/SVG blur filter — cheaper to render
  at scale and avoids filter-performance edge cases with many nodes.
- Dark palette throughout: `#0C0C0C` background, `#F0EDE8` labels, `#888480` secondary labels,
  `#2A2A2A` orbit rings — the app's existing tokens, nothing new introduced.

## Testing

Pure layout functions in `lib/vault/galaxy-layout.ts` get full unit coverage in
`lib/__tests__/galaxy-layout.test.ts`: determinism (same input → same output across repeated
calls), collision relaxation actually separates overlapping circles, empty-vault and
single-project edge cases. No component/route tests (matches the house convention — vitest only
collects `lib/**/*.test.ts`).

## Out of scope

- Any relatedness, embedding, or LLM feature. This Map never calls a Make webhook.
- A real zoom camera / continuous pan-zoom (may be reconsidered later; today's decision is
  discrete drill-down only).
- Editing/organizing from the Map (moving a document to a different project, renaming, etc.) —
  it's a read-only observability view; those actions stay in Folders/List.

## Cleanup

Delete `public/mockups/galaxy-v1.html` (the comparison mockup used to settle the layout question)
before or during implementation — it's a throwaway artifact, not part of the shipped app.
