import { describe, it, expect } from "vitest"
import { normalizeForHash, sha256Hex, contentHash } from "@/lib/vault/hash"

describe("normalizeForHash", () => {
  it("treats CRLF and LF as identical", () => {
    expect(normalizeForHash("a\r\nb")).toBe(normalizeForHash("a\nb"))
  })

  it("treats a lone CR as a newline", () => {
    expect(normalizeForHash("a\rb")).toBe(normalizeForHash("a\nb"))
  })

  it("ignores differences in trailing newlines", () => {
    expect(normalizeForHash("body")).toBe(normalizeForHash("body\n\n\n"))
  })

  it("ignores leading blank lines", () => {
    expect(normalizeForHash("\n\nbody")).toBe(normalizeForHash("body"))
  })

  it("strips per-line trailing whitespace", () => {
    expect(normalizeForHash("a   \nb\t\n")).toBe("a\nb")
  })

  it("preserves leading indentation, which is semantic in markdown", () => {
    expect(normalizeForHash("    code block")).toBe("    code block")
  })

  it("excludes frontmatter, so identical bodies with different metadata match", () => {
    // Asserted explicitly because it is a design decision, not an accident: editing
    // frontmatter must not create a duplicate document.
    const a = "---\ntitle: One\ntags: [x]\n---\nsame body\n"
    const b = "---\ntitle: Two\n---\nsame body\n"
    expect(normalizeForHash(a)).toBe(normalizeForHash(b))
    expect(normalizeForHash(a)).toBe("same body")
  })

  it("still distinguishes genuinely different bodies", () => {
    expect(normalizeForHash("one")).not.toBe(normalizeForHash("two"))
  })
})

describe("sha256Hex", () => {
  it("produces the known digest for a known input", async () => {
    // sha256("abc")
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    )
  })

  it("produces 64 hex chars", async () => {
    const h = await sha256Hex("anything")
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })

  it("is stable across calls", async () => {
    expect(await sha256Hex("x")).toBe(await sha256Hex("x"))
  })
})

describe("contentHash", () => {
  it("collapses whitespace-only differences to the same hash", async () => {
    expect(await contentHash("a\r\nb\n\n")).toBe(await contentHash("a\nb"))
  })

  it("differs for different content", async () => {
    expect(await contentHash("a")).not.toBe(await contentHash("b"))
  })
})
