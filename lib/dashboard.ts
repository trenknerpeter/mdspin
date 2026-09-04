// lib/dashboard.ts
//
// Data + pure aggregation for the logged-in Dashboard. One lightweight fetch of
// the columns we need across the user's conversions (RLS scopes to the signed-in
// user), then pure compute functions so values like savings can recompute when
// the "calls/mo" input changes without re-querying. Cheap at current scale —
// same caveat as listSpinStats/listTags in lib/library.ts.

import { createClient } from "@/lib/supabase/client"
import { estimateOriginalTokens, estimateMarkdownTokens, computeSavings } from "@/lib/roi"

// Exactly the columns the dashboard aggregations need (no markdown_text — large).
export interface DashboardRow {
  converted_at: string
  word_count: number | null
  file_type: string
  source_bytes: number | null
  brief_generated_at: string | null
  in_vault: boolean
  source_type: string
}

const DASHBOARD_FIELDS =
  "converted_at, word_count, file_type, source_bytes, brief_generated_at, in_vault, source_type"

export async function fetchDashboardRows(): Promise<DashboardRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("conversions")
    .select(DASHBOARD_FIELDS)
    .order("converted_at", { ascending: false })
  if (error) throw error
  return (data ?? []) as DashboardRow[]
}

export interface DashboardStats {
  totalSpins: number
  spinsThisMonth: number
  totalWords: number
  briefsGenerated: number
  vaultCount: number
}

// Pure: headline counts. `now` is injectable for testing.
//
// totalSpins/spinsThisMonth/totalWords count CONVERSIONS ONLY — a doc actually
// run through the conversion backend. Notes and other ingested docs never
// touched that pipeline, so counting them here would report a "words
// converted" figure that includes words nobody converted. vaultCount is
// deliberately NOT restricted: a note the user curated into the Vault is a
// vault doc regardless of how it got there.
export function computeDashboardStats(rows: DashboardRow[], now: Date = new Date()): DashboardStats {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  let totalSpins = 0
  let spinsThisMonth = 0
  let totalWords = 0
  let briefsGenerated = 0
  let vaultCount = 0
  for (const r of rows) {
    if (r.source_type === "conversion") {
      totalSpins++
      if (new Date(r.converted_at).getTime() >= monthStart) spinsThisMonth++
      totalWords += r.word_count ?? 0
    }
    if (r.brief_generated_at) briefsGenerated++
    if (r.in_vault) vaultCount++
  }
  return { totalSpins, spinsThisMonth, totalWords, briefsGenerated, vaultCount }
}

export interface ActivityPoint {
  date: string // YYYY-MM-DD
  count: number
}

// Pure: rows-per-day for the last `days` days, oldest→newest, zero-filled.
// Structural on purpose (only reads converted_at) so callers can pass either
// DashboardRow[] (History's conversions) or a vault doc window (Dashboard's
// Vault pulse) without a near-duplicate function.
export function computeActivitySeries(
  rows: Pick<DashboardRow, "converted_at">[],
  days = 30,
  now: Date = new Date()
): ActivityPoint[] {
  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

  // Seed an ordered map of the last `days` days at zero.
  const buckets = new Map<string, number>()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    buckets.set(dayKey(d), 0)
  }
  for (const r of rows) {
    const key = dayKey(new Date(r.converted_at))
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }))
}

export interface CumulativeSavings {
  tokensSaved: number
  monthlySavings: number
  reductionPct: number
  trackedFrom: string | null // earliest converted_at among rows with source_bytes
  trackedCount: number // how many rows contributed (have source_bytes)
}

// Pure: cumulative exact savings. Only rows with a recorded source_bytes count
// (the "exact, going-forward" decision); rows without it are excluded.
export function computeCumulativeSavings(
  rows: DashboardRow[],
  monthlyCalls: number
): CumulativeSavings {
  let origTokens = 0
  let mdTokens = 0
  let trackedCount = 0
  let trackedFrom: string | null = null
  for (const r of rows) {
    if (r.source_bytes == null) continue
    trackedCount++
    origTokens += estimateOriginalTokens(r.source_bytes, r.file_type)
    mdTokens += estimateMarkdownTokens(r.word_count ?? 0)
    if (!trackedFrom || r.converted_at < trackedFrom) trackedFrom = r.converted_at
  }
  const { reductionPct, monthlySavings } = computeSavings({ origTokens, mdTokens, monthlyCalls })
  return {
    tokensSaved: Math.max(0, origTokens - mdTokens),
    monthlySavings,
    reductionPct,
    trackedFrom,
    trackedCount,
  }
}

// Structural row types below take only what each function needs, so callers
// can pass either a DashboardRow-shaped object or a full library Spin without
// this module importing lib/library.ts.

export interface VaultPulseRow {
  converted_at: string
  source_type: string
}

export interface VaultPulseBucket {
  sourceType: string
  count: number
}

export interface VaultPulse {
  windowDays: number // the window actually reported (may differ from the requested one)
  total: number
  bySource: VaultPulseBucket[] // desc by count
  widened: boolean // true when the primary window was empty and we fell back
}

// Pure: how many vault docs arrived recently, split by how they arrived.
// `converted_at` is each row's insert timestamp regardless of source_type (see
// createNote/buildConversionRows in lib/library.ts), so it genuinely means
// "when this doc arrived" — not "when it was last edited".
//
// If the primary window (default 7 days) is empty, widen once to
// `fallbackDays` (default 30) rather than rendering a permanently blank card.
// If that's still empty, callers render one honest "nothing new" line — never
// an inferred number.
export function computeVaultPulse(
  docs: VaultPulseRow[],
  opts?: { windowDays?: number; fallbackDays?: number; now?: Date }
): VaultPulse {
  const windowDays = opts?.windowDays ?? 7
  const fallbackDays = opts?.fallbackDays ?? 30
  const now = opts?.now ?? new Date()

  const countWithin = (days: number): VaultPulseBucket[] => {
    const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000
    const counts = new Map<string, number>()
    for (const d of docs) {
      if (new Date(d.converted_at).getTime() < cutoff) continue
      counts.set(d.source_type, (counts.get(d.source_type) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([sourceType, count]) => ({ sourceType, count }))
      .sort((a, b) => b.count - a.count)
  }

  const primary = countWithin(windowDays)
  const primaryTotal = primary.reduce((sum, b) => sum + b.count, 0)
  if (primaryTotal > 0) {
    return { windowDays, total: primaryTotal, bySource: primary, widened: false }
  }

  const widened = countWithin(fallbackDays)
  const widenedTotal = widened.reduce((sum, b) => sum + b.count, 0)
  return { windowDays: fallbackDays, total: widenedTotal, bySource: widened, widened: true }
}

export interface ProjectActivityRow {
  converted_at: string
  project_ids: string[]
}

// Pure: most recent arrival per project, from whatever doc window the caller
// passes in. Projects with no doc in that window get no entry — the dashboard
// must show no date rather than guess one ("empty beats speculative").
export function computeProjectActivity(docs: ProjectActivityRow[]): Record<string, string> {
  const latest: Record<string, string> = {}
  for (const d of docs) {
    for (const projectId of d.project_ids) {
      if (!latest[projectId] || d.converted_at > latest[projectId]) {
        latest[projectId] = d.converted_at
      }
    }
  }
  return latest
}

const SOURCE_LABELS: Record<string, string> = {
  mcp: "Added by an agent",
  upload: "Uploaded",
  note: "Written here",
  conversion: "Converted",
  api: "Via API",
}

// Passthrough fallback is deliberate: it absorbs any future source_type
// without a crash or a blank label.
export function sourceLabel(sourceType: string): string {
  return SOURCE_LABELS[sourceType] ?? sourceType
}
