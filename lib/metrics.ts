import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Product metrics, read from the `metrics.*` views in Postgres.
 *
 * These come from database state rather than analytics events on purpose: vault
 * actions go browser -> Supabase directly, so no server event can see them, and
 * state answers retroactively across all existing history instead of only from
 * the day instrumentation shipped.
 *
 * The `metrics` schema is not exposed to the API. Everything here goes through
 * one SECURITY DEFINER function, `public.metrics_snapshot()`, which only the
 * service role may execute.
 */

export type ActiveUsers = { dau: number; wau: number; mau: number }

export type MetricsTotals = {
  signed_up: number
  activated: number
  never_converted: number
  used_vault: number
  conversions: number
  vault_docs: number
}

export type FeatureReach = {
  feature: string
  users_reached: number
  activated: number
  pct_of_activated: number | null
}

export type FunnelWeek = {
  signup_week: string
  signed_up: number
  converted_once: number
  converted_3plus: number
  used_vault: number
  created_project: number
  active_last_30d: number
}

export type ActivityDay = {
  date: string
  audience: "signed_in" | "anonymous"
  actors: number
  conversions: number
}

export type QuotaPressure = {
  signed_in_hits: number
  anonymous_hits: number
  distinct_actors: number
}

export type MetricsSnapshot = {
  generated_at: string
  active: ActiveUsers
  totals: MetricsTotals
  feature_reach: FeatureReach[]
  funnel: FunnelWeek[]
  activity: ActivityDay[]
  quota: QuotaPressure
}

/** Returns null when the service role key is missing or the RPC fails. */
export async function getMetricsSnapshot(): Promise<MetricsSnapshot | null> {
  const supabase = createAdminClient()
  if (!supabase) return null

  const { data, error } = await supabase.rpc("metrics_snapshot")
  if (error || !data) {
    console.error("[metrics] metrics_snapshot failed:", error?.message)
    return null
  }
  return data as MetricsSnapshot
}

/** Percentage of `total`, rounded to one decimal. Renders "—" upstream when total is 0. */
export function pct(part: number, total: number): number | null {
  if (!total) return null
  return Math.round((1000 * part) / total) / 10
}
