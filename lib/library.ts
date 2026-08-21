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
// withNullMarkdown() to get a Spin with an explicit `markdown_text: null`
// rather than `undefined`. Content requires getSpin() or updateSpin()'s
// returned row.
const SPIN_LIST_FIELDS = SPIN_COMMON_FIELDS
const SPIN_DETAIL_FIELDS = `${SPIN_COMMON_FIELDS}, markdown_text`

function withNullMarkdown(rows: unknown[]): Spin[] {
  return (rows as Omit<Spin, "markdown_text">[]).map((r) => ({ ...r, markdown_text: null }))
}

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
  return withNullMarkdown(data ?? [])
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
  return (data as Spin) ?? null
}

export interface UpdateSpinFields {
  title?: string | null
  project_id?: string | null
  tags?: string[]
  // When present, word_count is recomputed to match — the two must never drift.
  markdown_text?: string
}

// Returns the updated row (full detail fields) so callers can trust the fresh
// word_count/updated_at/version rather than guessing at them locally.
export async function updateSpin(id: string, fields: UpdateSpinFields): Promise<Spin> {
  const supabase = createClient()
  const payload: Record<string, unknown> = { ...fields }
  if (fields.markdown_text !== undefined) {
    payload.word_count = countWords(fields.markdown_text)
  }
  const { data, error } = await supabase
    .from("conversions")
    .update(payload)
    .eq("id", id)
    .select(SPIN_DETAIL_FIELDS)
    .single()
  if (error) throw error
  return data as Spin
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
    })
    .select(SPIN_DETAIL_FIELDS)
    .single()
  if (error) throw error
  return data as Spin
}

// Count of in-vault docs still waiting on a summary — powers the backfill banner.
export async function countPendingSummaries(): Promise<number> {
  const supabase = createClient()
  const { count, error } = await supabase
    .from("conversions")
    .select("id", { count: "exact", head: true })
    .eq("in_vault", true)
    .eq("summary_status", "pending")
  if (error) throw error
  return count ?? 0
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
  const { data, error } = await supabase.from("conversions").select("project_id").eq("in_vault", true)
  if (error) throw error
  const rows = (data ?? []) as { project_id: string | null }[]
  const byProject: Record<string, number> = {}
  let unfiled = 0
  for (const row of rows) {
    if (row.project_id) byProject[row.project_id] = (byProject[row.project_id] ?? 0) + 1
    else unfiled++
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
  return withNullMarkdown(data ?? [])
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
