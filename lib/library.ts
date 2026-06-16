import { createClient } from "@/lib/supabase/client"

export const UNFILED = "__unfiled__"

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
  word_count: number | null
  markdown_text: string | null
  project_id: string | null
  tags: string[]
  in_vault: boolean
  converted_at: string
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

const SPIN_FIELDS =
  "id, filename, title, file_type, word_count, markdown_text, project_id, tags, in_vault, converted_at"

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
  let q = supabase.from("conversions").select(SPIN_FIELDS)
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
  return (data ?? []) as Spin[]
}

export async function updateSpin(
  id: string,
  fields: { title?: string | null; project_id?: string | null; tags?: string[] }
) {
  const supabase = createClient()
  const { error } = await supabase.from("conversions").update(fields).eq("id", id)
  if (error) throw error
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
export async function addToVault(
  ids: string[],
  opts: { projectId: string | null; tags: string[] }
) {
  if (ids.length === 0) return
  const supabase = createClient()
  const { error } = await supabase
    .from("conversions")
    .update({ in_vault: true, project_id: opts.projectId, tags: opts.tags })
    .in("id", ids)
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
  let q = supabase.from("conversions").select(SPIN_FIELDS)
  const term = params.query ? escapeIlike(params.query) : ""
  if (term) {
    const like = `%${term}%`
    q = q.or(`filename.ilike.${like},title.ilike.${like},markdown_text.ilike.${like}`)
  }
  const { data, error } = await q
    .order("converted_at", { ascending: false })
    .range(params.from, params.to)
  if (error) throw error
  return (data ?? []) as Spin[]
}
