import { describe, it, expect } from "vitest"
import { evaluateUsage, ANON_LIFETIME_LIMIT, AUTH_DAILY_LIMIT } from "@/lib/usage-math"

describe("usage-math", () => {
  it("exposes the configured limits", () => {
    expect(ANON_LIFETIME_LIMIT).toBe(3)
    expect(AUTH_DAILY_LIMIT).toBe(20)
  })
  it("allows when count is below limit", () => {
    expect(evaluateUsage(0, 3)).toEqual({ allowed: true, remaining: 3, limit: 3 })
    expect(evaluateUsage(2, 3)).toEqual({ allowed: true, remaining: 1, limit: 3 })
  })
  it("blocks when count reaches limit", () => {
    expect(evaluateUsage(3, 3)).toEqual({ allowed: false, remaining: 0, limit: 3 })
    expect(evaluateUsage(5, 3)).toEqual({ allowed: false, remaining: 0, limit: 3 })
  })
})
