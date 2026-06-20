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
}

const DASHBOARD_FIELDS =
  "converted_at, word_count, file_type, source_bytes, brief_generated_at, in_vault"

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
export function computeDashboardStats(rows: DashboardRow[], now: Date = new Date()): DashboardStats {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  let spinsThisMonth = 0
  let totalWords = 0
  let briefsGenerated = 0
  let vaultCount = 0
  for (const r of rows) {
    if (new Date(r.converted_at).getTime() >= monthStart) spinsThisMonth++
    totalWords += r.word_count ?? 0
    if (r.brief_generated_at) briefsGenerated++
    if (r.in_vault) vaultCount++
  }
  return { totalSpins: rows.length, spinsThisMonth, totalWords, briefsGenerated, vaultCount }
}

export interface ActivityPoint {
  date: string // YYYY-MM-DD
  count: number
}

// Pure: spins-per-day for the last `days` days, oldest→newest, zero-filled.
export function computeActivitySeries(
  rows: DashboardRow[],
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
