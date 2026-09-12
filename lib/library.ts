import { createClient } from "@/lib/supabase/client"
import { countWords } from "@/lib/vault/text"
import { normalizeTag } from "@/lib/vault/tags"
import type { IngestSourceType } from "@/lib/vault/ingest"
import type { SummaryStatus } from "@/lib/vault/summary"

export const UNFILED = "__unfiled__"

// 'conversion' covers every existing row (the DB default); the rest are the
// provenance values Stage 1 ingest introduces.
export type SourceType = "conversion" | IngestSourceType

export interface Project {
  id: string
  name: string
  color: string | null
  created_at: string
  /** Subprojects nest exactly one level, so a project with a parent_id never has
   *  children of its own — enforced by the projects_single_level trigger. */
  parent_id: string | null
}

export interface Spin {
  id: string
  filename: string
  title: string | null
  file_type: string
  // null on list rows (SPIN_LIST_FIELDS omits it — a single doc can be 2.4MB).
  // Always populated on a row fetched via getSpin/createNote/updateSpin.
  markdown_text: string | null
  word_count: number | null
  /** Real membership from document_projects, earliest-linked-first (Stage 5 Phase C).
   *  Every document has 0 or 1 entries today — no write path can create a second. */
  project_ids: string[]
  tags: string[]
  in_vault: boolean
  source_type: SourceType
  converted_at: string
  updated_at: string
  version: number
  brief: string | null
  brief_generated_at: string | null
  summary: string | null
  summary_status: SummaryStatus | null
  summary_generated_at: string | null
  source_bytes: number | null
}

/** Raw `conversions` row shape as selected by this file's queries — still carries the
 *  singular `project_id` column, since that's what the database actually has until
 *  Stage 5 Phase D. `toSpin()` is the one seam that turns it into the array-shaped
 *  `Spin.project_ids` the rest of the app sees. */
interface ConversionRow {
  id: string
  filename: string
  title: string | null
  file_type: string
  markdown_text?: string | null
  word_count: number | null
  project_id: string | null
  tags: string[]
  in_vault: boolean
  source_type: SourceType
  converted_at: string
  updated_at: string
  version: number
  brief: string | null
  brief_generated_at: string | null
  summary: string | null
  summary_status: SummaryStatus | null
  summary_generated_at: string | null
  source_bytes: number | null
}

export function toSpin(row: ConversionRow, projectIds: string[]): Spin {
  return {
    id: row.id,
    filename: row.filename,
    title: row.title,
    file_type: row.file_type,
    markdown_text: row.markdown_text ?? null,
    word_count: row.word_count,
    project_ids: projectIds,
    tags: row.tags,
    in_vault: row.in_vault,
    source_type: row.source_type,
    converted_at: row.converted_at,
    updated_at: row.updated_at,
    version: row.version,
    brief: row.brief,
    brief_generated_at: row.brief_generated_at,
    summary: row.summary,
    summary_status: row.summary_status,
    summary_generated_at: row.summary_generated_at,
    source_bytes: row.source_bytes,
  }
}

/** Parallel to lib/vault/mappers.ts's identically-named helper — deliberately duplicated,
 *  not imported, matching this file's existing independence from lib/vault/ (see the
 *  Cloud Knowledge Hub strategy's "shared repo core" decision, which keeps this legacy
 *  browser layer separate for now rather than becoming a thin shim over it). */
export function projectIdsFromColumn(row: { project_id: string | null }): string[] {
  return row.project_id ? [row.project_id] : []
}

/** The array is always earliest-linked-first (see fetchProjectIdsByDocument's ordering
 *  below), so index 0 is "the" project for any surface that only shows one badge per
 *  document — recent-spins.tsx, the Vault list, and spin-detail-panel.tsx's dropdown. */
export function primaryProjectId(spin: Pick<Spin, "project_ids">): string | null {
  return spin.project_ids[0] ?? null
}

/** The top-level project a project belongs to — itself when it has no parent.
 *  One level of nesting means this is a single lookup, never a walk.
 *  Mirrors the `coalesce(p.parent_id, p.id)` idiom in find_related_documents,
 *  vault_search_documents and vault_stats — change them together. */
/** Display path for a project: its own name, or "Parent / Child" for a subproject.
 *  One level of nesting means this is a single lookup, never a walk. */
export function projectPath(
  projectId: string,
  byId: Map<string, Pick<Project, "name" | "parent_id">>
): string {
  const project = byId.get(projectId)
  if (!project) return ""
  if (!project.parent_id) return project.name
  const parent = byId.get(project.parent_id)
  return parent ? `${parent.name} / ${project.name}` : project.name
}

export function rootProjectId(
  projectId: string | null,
  byId: Map<string, Pick<Project, "parent_id">>
): string | null {
  if (!projectId) return null
  return byId.get(projectId)?.parent_id ?? projectId
}

/** A project plus its subprojects — the set of project ids whose documents belong
 *  "inside" it. Returns [projectId] for a subproject (it can't have children). */
export function descendantProjectIds(
  projectId: string,
  projects: Pick<Project, "id" | "parent_id">[]
): string[] {
  return [projectId, ...projects.filter((p) => p.parent_id === projectId).map((p) => p.id)]
}

/** Direct per-project counts -> counts including one level of subprojects.
 *  A doc filed in a subproject counts once at the subproject and once at its root,
 *  which is what a folder card should show. */
export function rollUpProjectCounts(
  byProject: Record<string, number>,
  projects: Pick<Project, "id" | "parent_id">[]
): Record<string, number> {
  const out: Record<string, number> = { ...byProject }
  for (const p of projects) {
    if (!p.parent_id) continue
    out[p.parent_id] = (out[p.parent_id] ?? 0) + (byProject[p.id] ?? 0)
  }
  return out
}

/** Batched project-membership lookup — never call this once per row. No explicit
 *  user_id filter: unlike lib/vault/repo.ts (which also serves a service-role path where
 *  RLS is bypassed), every query in this file is the anon/browser client, and every other
 *  query here already relies on RLS alone. */
export async function fetchProjectIdsByDocument(documentIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  if (documentIds.length === 0) return map
  const supabase = createClient()
  const { data, error } = await supabase
    .from("document_projects")
    .select("document_id, project_id")
    .in("document_id", documentIds)
    .order("added_at", { ascending: true })
    .order("project_id", { ascending: true })
  if (error) throw error
  for (const r of (data ?? []) as { document_id: string; project_id: string }[]) {
    const existing = map.get(r.document_id)
    if (existing) existing.push(r.project_id)
    else map.set(r.document_id, [r.project_id])
  }
  return map
}

// Lighter than Spin: exactly what find_related_conversions returns and what list rows render.
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
  /** IDF-weighted cosine affinity to the source doc, bucketed for display.
   *  Project membership already asserts "these are related"; this says how tightly. */
  strength?: "strong" | "medium" | "weak"
}

// Pure: merge per-source related results into one ranked, deduped list.
// Dedupes by id keeping the highest-ranked instance; on a tie (including a missing
// rank, treated as 0) the first-seen entry wins. Drops excluded ids, sorts by rank
// desc, caps at `max`.
export function mergeRelatedSpins(
  groups: RelatedSpin[][],
  excludeIds: string[],
  max = 5
): RelatedSpin[] {
  const exclude = new Set(excludeIds)
  const best = new Map<string, RelatedSpin>()
  for (const group of groups) {
    for (const s of group) {
      if (exclude.has(s.id)) continue
      const prev = best.get(s.id)
      if (!prev || (s.rank ?? 0) > (prev.rank ?? 0)) best.set(s.id, s)
    }
  }
  return Array.from(best.values())
    .sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0))
    .slice(0, max)
}

export interface TagCount {
  tag: string
  count: number
}

export interface ListSpinsParams {
  projectId?: string | null // a project id, UNFILED, or null/undefined for "all"
  /** Subproject ids to fold into projectId, resolved by the caller from its in-memory
   *  project list (descendantProjectIds) — one level means this is a filter, never a
   *  query. Pass [] to mean "just this folder, not its subprojects"; the grid decides,
   *  the data layer doesn't guess. */
  descendantIds?: string[]
  tag?: string | null
  query?: string | null
  from: number
  to: number
  inVault?: boolean
}

// ---- Projects (mirrors lib/presets.ts) ----

export async function listProjects(): Promise<Project[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, color, created_at, parent_id")
    .order("created_at", { ascending: true })
  if (error) throw error
  return (data ?? []) as Project[]
}

export async function createProject(
  name: string,
  color?: string | null,
  parentId?: string | null
): Promise<Project> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not signed in")
  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, name, color: color ?? null, parent_id: parentId ?? null })
    .select("id, name, color, created_at, parent_id")
    .single()
  if (error) throw error
  return data as Project
}

export async function renameProject(id: string, name: string) {
  const supabase = createClient()
  const { error } = await supabase.from("projects").update({ name }).eq("id", id)
  if (error) throw error
}

/** Preset swatches offered in the rail's "Change color" submenu — the only UI path to
 *  set a project's colour (MCP's create_project/update_project could always set it; the
 *  browser never had a picker, so every project made through the app sits at color=null).
 *  The app's own accent leads the list so a project can explicitly claim it, rather than
 *  only ever seeing it as the selection highlight. */
export const PROJECT_COLOR_PRESETS: readonly string[] = [
  "#FF4800", // accent
  "#4C8DFF",
  "#F2C94C",
  "#27AE60",
  "#BB6BD9",
  "#56CCF2",
  "#EB5757",
  "#F2994A",
]

export async function setProjectColor(id: string, color: string | null) {
  const supabase = createClient()
  const { error } = await supabase.from("projects").update({ color }).eq("id", id)
  if (error) throw error
}

export async function deleteProject(id: string) {
  // FK is ON DELETE SET NULL: spins are unfiled, never deleted.
  const supabase = createClient()
  const { error } = await supabase.from("projects").delete().eq("id", id)
  if (error) throw error
}

// ---- Spins ----

// Shared by both field lists below; markdown_text is the one column that differs.
const SPIN_COMMON_FIELDS =
  "id, filename, title, file_type, word_count, project_id, tags, in_vault, source_type, converted_at, updated_at, version, brief, brief_generated_at, summary, summary_status, summary_generated_at, source_bytes"

// Used by listSpins/listHistory. Omits markdown_text: a single document can be
// 2.4MB, and list pages fetch up to 100 rows on every filter change. PostgREST
// simply won't include the key when it isn't selected, so callers go through
// toSpin() to get a Spin with an explicit `markdown_text: null`
// rather than `undefined`. Content requires getSpin() or updateSpin()'s
// returned row.
const SPIN_LIST_FIELDS = SPIN_COMMON_FIELDS
const SPIN_DETAIL_FIELDS = `${SPIN_COMMON_FIELDS}, markdown_text`

function escapeIlike(q: string) {
  // Keep the .or() filter safe: strip commas/parens that would break PostgREST syntax.
  return q.replace(/[,()]/g, " ").trim()
}

export interface ConversionFileInput {
  filename: string
  file_type: string
  word_count: number | null
  markdown_text: string
}

// Pure: build insert rows for files being added to the Vault.
export function buildConversionRows(
  files: ConversionFileInput[],
  opts: { projectId: string | null; tags: string[] },
  userId: string
) {
  return files.map((f) => ({
    user_id: userId,
    filename: f.filename,
    file_type: f.file_type,
    word_count: f.word_count,
    markdown_text: f.markdown_text,
    project_id: opts.projectId,
    tags: opts.tags,
    in_vault: true,
    // Enqueue for summarisation. Redundant with the column default added in
    // 20260904000000_enqueue_summaries_backfill.sql, but explicit here so the intent is
    // visible at the write site and directly unit-testable.
    summary_status: "pending",
  }))
}

export async function listSpins(params: ListSpinsParams): Promise<Spin[]> {
  const supabase = createClient()
  let q = supabase.from("conversions").select(SPIN_LIST_FIELDS)
  if (params.inVault) q = q.eq("in_vault", true)

  if (params.projectId === UNFILED) {
    q = q.is("project_id", null)
  } else if (params.projectId) {
    const ids = [params.projectId, ...(params.descendantIds ?? [])]
    // .eq for the single-id case keeps today's query plan (and today's behaviour) intact.
    q = ids.length === 1 ? q.eq("project_id", ids[0]) : q.in("project_id", ids)
  }

  if (params.tag) {
    q = q.contains("tags", [params.tag])
  }

  const term = params.query ? escapeIlike(params.query) : ""
  if (term) {
    const like = `%${term}%`
    q = q.or(`filename.ilike.${like},title.ilike.${like},markdown_text.ilike.${like}`)
  }

  const { data, error } = await q
    .order("converted_at", { ascending: false })
    .range(params.from, params.to)
  if (error) throw error
  const rows = (data ?? []) as ConversionRow[]
  const projectIdsByDoc = await fetchProjectIdsByDocument(rows.map((r) => r.id))
  return rows.map((r) => toSpin(r, projectIdsByDoc.get(r.id) ?? []))
}

// Sibling docs in the SAME project as the source, ranked by content affinity.
// Scoping to the project is deliberate: membership is user-curated, which beats any lexical
// guess at "is this related". Docs that are Unfiled or alone in a project return [] — most
// documents genuinely have no related documents, and an empty panel is the honest answer.
// Default is 10, not 5: a project can hold more siblings than a lexical top-5 ever returned.
export async function findRelatedSpins(sourceId: string, maxResults = 10): Promise<RelatedSpin[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("find_related_conversions", {
    source_id: sourceId,
    max_results: maxResults,
  })
  if (error) throw error
  return (data ?? []) as RelatedSpin[]
}

// Fetch a single vault spin by id (used when opening a related doc not on the current page).
// Scoped to in_vault so a hand-crafted ?spin= can't open a non-vault conversion on the Vault page.
export async function getSpin(id: string): Promise<Spin | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("conversions")
    .select(SPIN_DETAIL_FIELDS)
    .eq("id", id)
    .eq("in_vault", true)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as ConversionRow
  const projectIdsByDoc = await fetchProjectIdsByDocument([row.id])
  return toSpin(row, projectIdsByDoc.get(row.id) ?? [])
}

export interface UpdateSpinFields {
  title?: string | null
  project_id?: string | null
  tags?: string[]
  // When present, word_count is recomputed to match — the two must never drift.
  markdown_text?: string
}

// Pure payload builder for updateSpin, exported so the invalidation rule below is
// unit-testable — updateSpin itself does I/O and this repo's vitest config only collects
// lib/**/*.test.ts.
export function buildSpinUpdatePayload(fields: UpdateSpinFields): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...fields }
  if (fields.markdown_text !== undefined) {
    payload.word_count = countWords(fields.markdown_text)
    // Re-queue the summary whenever the body changes, so it never describes a version of
    // the document that no longer exists. The MCP write paths get this from
    // vault_update_document / vault_append_to_document; this is the browser note editor,
    // which writes through PostgREST directly and so needs it stated here too.
    //
    // Attempts reset to 0 because this is a genuinely new piece of work, not a retry of
    // the old one — a doc that previously exhausted its budget deserves a fresh chance
    // against its new content.
    payload.summary_status = "pending"
    payload.summary_attempts = 0
  }
  return payload
}

// Returns the updated row (full detail fields) so callers can trust the fresh
// word_count/updated_at/version rather than guessing at them locally.
export async function updateSpin(id: string, fields: UpdateSpinFields): Promise<Spin> {
  const supabase = createClient()
  const payload = buildSpinUpdatePayload(fields)
  const { data, error } = await supabase
    .from("conversions")
    .update(payload)
    .eq("id", id)
    .select(SPIN_DETAIL_FIELDS)
    .single()
  if (error) throw error
  const row = data as ConversionRow
  return toSpin(row, projectIdsFromColumn(row))
}

// Create an empty note directly in the Vault. A note IS a vault doc from the
// moment it exists — no draft limbo, no separate "unsaved note" state.
export async function createNote(): Promise<Spin> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not signed in")
  const { data, error } = await supabase
    .from("conversions")
    .insert({
      user_id: user.id,
      filename: "untitled.md",
      file_type: "md",
      title: null,
      markdown_text: "",
      word_count: 0,
      in_vault: true,
      source_type: "note",
      summary_status: "pending",
    })
    .select(SPIN_DETAIL_FIELDS)
    .single()
  if (error) throw error
  const row = data as ConversionRow
  return toSpin(row, projectIdsFromColumn(row))
}

/** The ids between two rows inclusive, in the list's own order — shift-click range
 *  selection. Order-agnostic about which end you clicked first. Returns just the target
 *  when either id isn't in the list (e.g. the anchor scrolled out of a refreshed page),
 *  which degrades to a plain click rather than selecting nothing. */
export function idsInRange(orderedIds: string[], anchorId: string, targetId: string): string[] {
  const a = orderedIds.indexOf(anchorId)
  const b = orderedIds.indexOf(targetId)
  if (a === -1 || b === -1) return [targetId]
  return orderedIds.slice(Math.min(a, b), Math.max(a, b) + 1)
}

/** Move several documents into a project (or to Unfiled with null) in one update.
 *  Writes conversions.project_id, never document_projects directly: the
 *  conversions_sync_document_projects trigger mirrors the change, and writing the join
 *  table straight would be silently wiped the next time anything touched project_id
 *  (see 20260903000001_stage5_sync_trigger.sql). */
export async function moveSpinsToProject(ids: string[], projectId: string | null) {
  if (ids.length === 0) return
  const supabase = createClient()
  const { error } = await supabase
    .from("conversions")
    .update({ project_id: projectId })
    .in("id", ids)
  if (error) throw error
}

// Which documents need updating to gain `tag`, and their full new tags array — pure so
// it's unit-testable. Docs that already have the (normalized) tag are omitted, since
// Postgres/PostgREST can't append-and-dedupe an array across several rows in a single
// query-builder call, so addTagToSpins issues one update per row that actually changes.
export function planTagAdditions(
  targets: { id: string; tags: string[] }[],
  tag: string
): { id: string; tags: string[] }[] {
  const t = normalizeTag(tag)
  if (!t) return []
  return targets.filter((s) => !s.tags.includes(t)).map((s) => ({ id: s.id, tags: [...s.tags, t] }))
}

/** Add one tag to several documents at once, preserving each document's existing tags.
 *  Callers pass each target's current tags (already in memory from the list view) rather
 *  than this function re-fetching them, since the list view already has them loaded. */
export async function addTagToSpins(targets: { id: string; tags: string[] }[], tag: string): Promise<void> {
  const updates = planTagAdditions(targets, tag)
  if (updates.length === 0) return
  const supabase = createClient()
  const results = await Promise.all(
    updates.map((u) => supabase.from("conversions").update({ tags: u.tags }).eq("id", u.id))
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) throw failed.error
}

export async function deleteSpin(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from("conversions").delete().eq("id", id)
  if (error) throw error
}

export interface SpinStats {
  total: number
  unfiled: number
  byProject: Record<string, number>
}

// Counts for the rail (All / Unfiled / per project), computed client-side.
// Cheap at current scale; revisit with an RPC if libraries grow very large.
export async function listSpinStats(): Promise<SpinStats> {
  const supabase = createClient()
  const { data, error } = await supabase.from("conversions").select("id").eq("in_vault", true)
  if (error) throw error
  const rows = (data ?? []) as { id: string }[]
  const projectIdsByDoc = await fetchProjectIdsByDocument(rows.map((r) => r.id))
  const byProject: Record<string, number> = {}
  let unfiled = 0
  for (const row of rows) {
    const projectIds = projectIdsByDoc.get(row.id) ?? []
    if (projectIds.length === 0) {
      unfiled++
    } else {
      for (const projectId of projectIds) {
        byProject[projectId] = (byProject[projectId] ?? 0) + 1
      }
    }
  }
  return { total: rows.length, unfiled, byProject }
}

/** One folder card's worth of data. `projectId: null` is the Unfiled card. */
export interface FolderSummary {
  projectId: string | null
  count: number
  /** converted_at of the newest doc in this folder, or null when the folder is empty.
   *  Null rather than a guessed date: the card must show nothing rather than invent
   *  activity ("empty beats speculative"). */
  lastActivity: string | null
  /** Up to 3 doc titles, newest first — a preview of what's inside. */
  recentTitles: string[]
}

const RECENT_TITLES_PER_FOLDER = 3

export interface FolderSummaryRow {
  title: string | null
  filename: string
  converted_at: string
  project_ids: string[]
}

/** Pure: fold vault rows into one summary per folder, plus an Unfiled bucket.
 *  `rows` MUST already be sorted newest-first — the caller's query does that, so this
 *  stays a single pass and `recentTitles` order falls out for free.
 *  Every project gets an entry even at count 0, so a freshly created folder still
 *  renders a card instead of silently disappearing from the grid. */
export function computeFolderSummaries(
  rows: FolderSummaryRow[],
  projects: Pick<Project, "id">[]
): FolderSummary[] {
  const byId = new Map<string | null, FolderSummary>()
  const blank = (projectId: string | null): FolderSummary => ({
    projectId,
    count: 0,
    lastActivity: null,
    recentTitles: [],
  })
  for (const p of projects) byId.set(p.id, blank(p.id))
  byId.set(null, blank(null))

  for (const row of rows) {
    // A doc with no project membership belongs to the Unfiled bucket.
    const keys: (string | null)[] = row.project_ids.length > 0 ? row.project_ids : [null]
    for (const key of keys) {
      // Ignore membership pointing at a project we weren't given (deleted mid-flight).
      const bucket = byId.get(key)
      if (!bucket) continue
      bucket.count++
      if (!bucket.lastActivity || row.converted_at > bucket.lastActivity) {
        bucket.lastActivity = row.converted_at
      }
      if (bucket.recentTitles.length < RECENT_TITLES_PER_FOLDER) {
        bucket.recentTitles.push(row.title || row.filename)
      }
    }
  }
  return Array.from(byId.values())
}

// Raw rows for the folder grid, newest-first (computeFolderSummaries relies on that
// order). Deliberately split from computeFolderSummaries so the caller can fetch this in
// parallel with listProjects rather than chaining behind it, and so the folding logic
// stays pure and unit-testable. Like listSpinStats/listTags this scans the user's vault
// rows client-side — cheap at current scale; revisit with an RPC if libraries grow large.
export async function listFolderRows(): Promise<FolderSummaryRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("conversions")
    .select("id, title, filename, converted_at")
    .eq("in_vault", true)
    .order("converted_at", { ascending: false })
  if (error) throw error
  const rows = (data ?? []) as { id: string; title: string | null; filename: string; converted_at: string }[]
  const projectIdsByDoc = await fetchProjectIdsByDocument(rows.map((r) => r.id))
  return rows.map((r) => ({
    title: r.title,
    filename: r.filename,
    converted_at: r.converted_at,
    project_ids: projectIdsByDoc.get(r.id) ?? [],
  }))
}

// Pure counting/sorting step of listTags, split out so it's unit-testable without
// mocking Supabase — same split as buildSpinUpdatePayload/updateSpin.
export function countTags(rows: { tags: string[] | null }[]): TagCount[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    for (const t of row.tags ?? []) {
      counts.set(t, (counts.get(t) ?? 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

// Distinct tags with counts, computed client-side from the user's vault rows.
// Cheap at current scale; revisit with an RPC if libraries grow very large.
// Scoped like listSpins: UNFILED for unfiled documents, a project id (plus its
// descendantIds, so a root project's tag list includes its subprojects' tags — matching
// the file list, which shows a root's subprojects' documents too) for that project's
// subtree, or omitted/null for every project ("All files").
export async function listTags(projectId?: string | null, descendantIds?: string[]): Promise<TagCount[]> {
  const supabase = createClient()
  let q = supabase.from("conversions").select("tags").eq("in_vault", true)
  if (projectId === UNFILED) {
    q = q.is("project_id", null)
  } else if (projectId) {
    const ids = [projectId, ...(descendantIds ?? [])]
    q = ids.length === 1 ? q.eq("project_id", ids[0]) : q.in("project_id", ids)
  }
  const { data, error } = await q
  if (error) throw error
  return countTags((data ?? []) as { tags: string[] | null }[])
}

// Promote already-saved (auto-saved) conversions into the Vault.
// project_id / tags are only written when explicitly provided, so a bare
// addToVault([id]) (e.g. History quick-add) never clobbers existing organization.
export async function addToVault(
  ids: string[],
  opts?: { projectId?: string | null; tags?: string[] }
) {
  if (ids.length === 0) return
  const supabase = createClient()
  const update: { in_vault: true; project_id?: string | null; tags?: string[] } = { in_vault: true }
  if (opts?.projectId !== undefined) update.project_id = opts.projectId
  if (opts?.tags !== undefined) update.tags = opts.tags
  const { error } = await supabase.from("conversions").update(update).in("id", ids)
  if (error) throw error

  // Enqueue for summarisation, but only for rows that were never enqueued (legacy
  // pre-default History conversions). This is the one path the column default cannot
  // cover, because it UPDATEs an existing row rather than inserting one.
  //
  // Deliberately a second scoped statement rather than a field on `update` above: setting
  // summary_status unconditionally would wipe a 'ready' or 'manual' status whenever a
  // document is removed from the vault and later re-added, throwing away a real summary
  // and re-spending a Make operation to regenerate it.
  const { error: enqueueError } = await supabase
    .from("conversions")
    .update({ summary_status: "pending" })
    .in("id", ids)
    .is("summary_status", null)
  if (enqueueError) throw enqueueError
}

// Insert brand-new rows straight into the Vault (anonymous resume path).
export async function insertVaultConversions(
  files: ConversionFileInput[],
  opts: { projectId: string | null; tags: string[] }
) {
  if (files.length === 0) return
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not signed in")
  const { error } = await supabase.from("conversions").insert(buildConversionRows(files, opts, user.id))
  if (error) throw error
}

export async function removeFromVault(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from("conversions").update({ in_vault: false }).eq("id", id)
  if (error) throw error
}

// History page: every conversion (not just vault items).
export async function listHistory(params: {
  query?: string | null
  from: number
  to: number
}): Promise<Spin[]> {
  const supabase = createClient()
  let q = supabase.from("conversions").select(SPIN_LIST_FIELDS)
  const term = params.query ? escapeIlike(params.query) : ""
  if (term) {
    const like = `%${term}%`
    q = q.or(`filename.ilike.${like},title.ilike.${like},markdown_text.ilike.${like}`)
  }
  const { data, error } = await q
    .order("converted_at", { ascending: false })
    .range(params.from, params.to)
  if (error) throw error
  const rows = (data ?? []) as ConversionRow[]
  const projectIdsByDoc = await fetchProjectIdsByDocument(rows.map((r) => r.id))
  return rows.map((r) => toSpin(r, projectIdsByDoc.get(r.id) ?? []))
}

// Fetch just the markdown for one of the user's own conversions, vault or not
// (RLS's owner-select policy has no in_vault condition). Used by list-row
// copy/download buttons now that list queries omit markdown_text.
export async function getSpinMarkdown(id: string): Promise<string | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("conversions")
    .select("markdown_text")
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  return (data as { markdown_text: string | null } | null)?.markdown_text ?? null
}
