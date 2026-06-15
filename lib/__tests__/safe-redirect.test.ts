import { describe, it, expect } from "vitest"
import { safeNext } from "@/lib/safe-redirect"

describe("safeNext", () => {
  it("allows simple absolute paths", () => {
    expect(safeNext("/app")).toBe("/app")
    expect(safeNext("/app/spins")).toBe("/app/spins")
    expect(safeNext("/app?tab=1")).toBe("/app?tab=1")
  })
  it("falls back to /app for missing or non-string input", () => {
    expect(safeNext(null)).toBe("/app")
    expect(safeNext(undefined)).toBe("/app")
    expect(safeNext("")).toBe("/app")
  })
  it("rejects protocol-relative and absolute URLs", () => {
    expect(safeNext("//evil.com")).toBe("/app")
    expect(safeNext("https://evil.com")).toBe("/app")
    expect(safeNext("http://evil.com")).toBe("/app")
  })
  it("rejects backslash and control tricks", () => {
    expect(safeNext("/\\evil.com")).toBe("/app")
    expect(safeNext("/%2Fevil.com")).toBe("/app")
    expect(safeNext("not-a-path")).toBe("/app")
  })
  it("rejects encoded backslash and backslash anywhere", () => {
    expect(safeNext("/%5Cevil.com")).toBe("/app")
    expect(safeNext("/foo\\bar")).toBe("/app")
  })
  it("rejects control chars embedded mid-path", () => {
    expect(safeNext("/%09/evil")).toBe("/%09/evil") // %09 stays same-origin via concat; not rejected
    expect(safeNext("/foo\tbar")).toBe("/app") // literal control char rejected
  })
  it("honors a custom fallback", () => {
    expect(safeNext("//evil.com", "/")).toBe("/")
    expect(safeNext(null, "/")).toBe("/")
  })
})
