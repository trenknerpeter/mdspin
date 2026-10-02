import { describe, it, expect } from "vitest"
import { normalizeEmail } from "@/lib/waitlist"

describe("normalizeEmail", () => {
  it("trims and lowercases a valid address", () => {
    expect(normalizeEmail("  Peter@Example.COM ")).toBe("peter@example.com")
  })
  it("rejects junk", () => {
    for (const bad of ["", "nope", "a@b", "@x.com", "a b@c.com", 42, null, undefined]) {
      expect(normalizeEmail(bad)).toBeNull()
    }
  })
  it("rejects absurdly long input", () => {
    expect(normalizeEmail(`${"a".repeat(250)}@x.com`)).toBeNull()
  })
})
