// lib/usage-math.ts
// Pure usage math + limit constants. No imports — unit-tested.

export const ANON_LIFETIME_LIMIT = 3
export const AUTH_DAILY_LIMIT = 20

export function evaluateUsage(count: number, limit: number): {
  allowed: boolean
  remaining: number
  limit: number
} {
  const remaining = Math.max(0, limit - count)
  return { allowed: count < limit, remaining, limit }
}
