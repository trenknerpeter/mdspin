import { createAdminClient } from "@/lib/supabase/admin"

const ANON_DAILY_LIMIT = 3
const AUTH_DAILY_LIMIT = 20

export function getDailyLimit(identifierType: "user" | "ip"): number {
  return identifierType === "user" ? AUTH_DAILY_LIMIT : ANON_DAILY_LIMIT
}

export async function checkRateLimit(
  identifier: string,
  identifierType: "user" | "ip"
): Promise<{ allowed: boolean; remaining: number; limit: number; resetsAt: string }> {
  const supabase = createAdminClient()
  const limit = getDailyLimit(identifierType)

  const tomorrow = new Date()
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  tomorrow.setUTCHours(0, 0, 0, 0)
  const resetsAt = tomorrow.toISOString()

  if (!supabase) {
    console.warn("[rate-limit] Admin client not configured — skipping rate limit check")
    return { allowed: true, remaining: limit, limit, resetsAt }
  }

  const today = new Date().toISOString().split("T")[0]

  const { data, error } = await supabase
    .from("daily_usage")
    .select("conversion_count")
    .eq("identifier", identifier)
    .eq("identifier_type", identifierType)
    .eq("date", today)
    .maybeSingle()

  if (error) {
    console.error("[rate-limit] check failed:", error.message)
    // Fail open — don't block users if the DB query fails
    return { allowed: true, remaining: limit, limit, resetsAt }
  }

  const count = data?.conversion_count ?? 0
  const remaining = Math.max(0, limit - count)

  return { allowed: count < limit, remaining, limit, resetsAt }
}

export async function incrementUsage(
  identifier: string,
  identifierType: "user" | "ip"
): Promise<void> {
  const supabase = createAdminClient()
  if (!supabase) return

  const today = new Date().toISOString().split("T")[0]

  const { error } = await supabase.rpc("increment_daily_usage", {
    p_identifier: identifier,
    p_identifier_type: identifierType,
    p_date: today,
  })

  if (error) {
    console.error("[rate-limit] increment failed:", error.message)
  }
}
