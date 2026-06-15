import { describe, it, expect } from "vitest"
import { requiresSignIn } from "@/lib/gating"

describe("requiresSignIn", () => {
  it("never requires sign-in for authenticated users", () => {
    expect(requiresSignIn({ authenticated: true, mode: "url", fileCount: 0 })).toBe(false)
    expect(requiresSignIn({ authenticated: true, mode: "file", fileCount: 5 })).toBe(false)
  })
  it("allows anonymous single-file uploads", () => {
    expect(requiresSignIn({ authenticated: false, mode: "file", fileCount: 1 })).toBe(false)
  })
  it("requires sign-in for anonymous URL conversion", () => {
    expect(requiresSignIn({ authenticated: false, mode: "url", fileCount: 0 })).toBe(true)
  })
  it("requires sign-in for anonymous multi-file (batch) conversion", () => {
    expect(requiresSignIn({ authenticated: false, mode: "file", fileCount: 2 })).toBe(true)
  })
})
