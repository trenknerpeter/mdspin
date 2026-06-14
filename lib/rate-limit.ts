import { createAdminClient } from "@/lib/supabase/admin"
import { evaluateUsage, ANON_LIFETIME_LIMIT, AUTH_DAILY_LIMIT } from "@/lib/usage-math"

export interface RateResult {
  allowed: boolean
  remaining: number
  limit: number
  resetsAt: string | null // null for anon lifetime (no reset)
}

export function getLimit(identifierType: "user" | "ip"): number {
  return identifierType === "user" ? AUTH_DAILY_LIMIT : ANON_LIFETIME_LIMIT
}

function nextUtcMidnight(): string {
  const tomorrow = new Date()
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  tomorrow.setUTCHours(0, 0, 0, 0)
  return tomorrow.toISOString()
}

export async function checkRateLimit(
  identifier: string,
  identifierType: "user" | "ip"
): Promise<RateResult> {
  const supabase = createAdminClient()
  const limit = getLimit(identifierType)
  const resetsAt = identifierType === "user" ? nextUtcMidnight() : null

  if (!supabase) {
    console.warn("[rate-limit] Admin client not configured — skipping rate limit check")
    return { allowed: true, remaining: limit, limit, resetsAt }
  }

  if (identifierType === "user") {
    const today = new Date().toISOString().split("T")[0]
    const { data, error } = await supabase
      .from("daily_usage")
      .select("conversion_count")
      .eq("identifier", identifier)
      .eq("identifier_type", "user")
      .eq("date", today)
      .maybeSingle()

    if (error) {
      console.error("[rate-limit] daily check failed:", error.message)
      return { allowed: true, remaining: limit, limit, resetsAt } // fail open
    }
    const count = data?.conversion_count ?? 0
    return { ...evaluateUsage(count, limit), resetsAt }
  }

  const { data, error } = await supabase
    .from("anon_usage")
    .select("conversion_count")
    .eq("identifier", identifier)
    .maybeSingle()

  if (error) {
    console.error("[rate-limit] anon check failed:", error.message)
    return { allowed: true, remaining: limit, limit, resetsAt } // fail open
  }
  const count = data?.conversion_count ?? 0
  return { ...evaluateUsage(count, limit), resetsAt }
}

export async function incrementUsage(
  identifier: string,
  identifierType: "user" | "ip"
): Promise<void> {
  const supabase = createAdminClient()
  if (!supabase) return

  if (identifierType === "user") {
    const today = new Date().toISOString().split("T")[0]
    const { error } = await supabase.rpc("increment_daily_usage", {
      p_identifier: identifier,
      p_identifier_type: "user",
      p_date: today,
    })
    if (error) console.error("[rate-limit] daily increment failed:", error.message)
    return
  }

  const { error } = await supabase.rpc("increment_anon_usage", {
    p_identifier: identifier,
  })
  if (error) console.error("[rate-limit] anon increment failed:", error.message)
}
