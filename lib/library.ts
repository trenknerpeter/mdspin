import { createClient } from "@/lib/supabase/client"
import { countWords } from "@/lib/vault/text"
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
    .select("id, name, color, created_at")
    .order("created_at", { ascending: true })
  if (error) throw error
  return (data ?? []) as Project[]
}

export async function createProject(name: string, color?: string | null): Promise<Project> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not signed in")
  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, name, color: color ?? null })
    .select("id, name, color, created_at")
    .single()
  if (error) throw error
  return data as Project
}

export async function renameProject(id: string, name: string) {
  const supabase = createClient()
  const { error } = await supabase.from("projects").update({ name }).eq("id", id)
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
    q = q.eq("project_id", params.projectId)
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

// Distinct tags with counts, computed client-side from the user's vault rows.
// Cheap at current scale; revisit with an RPC if libraries grow very large.
export async function listTags(): Promise<TagCount[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("conversions").select("tags").eq("in_vault", true)
  if (error) throw error
  const counts = new Map<string, number>()
  for (const row of (data ?? []) as { tags: string[] | null }[]) {
    for (const t of row.tags ?? []) {
      counts.set(t, (counts.get(t) ?? 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
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
