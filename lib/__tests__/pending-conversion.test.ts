import { describe, it, expect } from "vitest"
import { isPendingFresh, PENDING_TTL_MS } from "@/lib/pending-conversion"

describe("isPendingFresh", () => {
  const now = 1_000_000_000
  it("accepts a stash inside the TTL", () => {
    expect(isPendingFresh(now - 1000, now)).toBe(true)
    expect(isPendingFresh(now - PENDING_TTL_MS, now)).toBe(true)
  })
  it("rejects an expired stash", () => {
    expect(isPendingFresh(now - PENDING_TTL_MS - 1, now)).toBe(false)
  })
  it("rejects a timestamp from the future (clock skew / tampering)", () => {
    expect(isPendingFresh(now + 60_000, now)).toBe(false)
  })
})
