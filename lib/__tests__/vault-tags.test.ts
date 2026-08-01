import { describe, it, expect } from "vitest"
import { normalizeTag, normalizeTags, tagsFromFrontmatter } from "@/lib/vault/tags"

describe("normalizeTag", () => {
  // Parity with the original inline `normalize` in components/library/tag-input.tsx.
  // If these drift, hand-typed and imported tags become separate facets in the vault.
  it("trims surrounding whitespace", () => {
    expect(normalizeTag("  hello  ")).toBe("hello")
  })

  it("strips a single leading hash", () => {
    expect(normalizeTag("#client")).toBe("client")
  })

  it("turns internal whitespace runs into single dashes", () => {
    expect(normalizeTag("client   work")).toBe("client-work")
  })

  it("lowercases", () => {
    expect(normalizeTag("Client-Work")).toBe("client-work")
  })

  it("returns an empty string for whitespace or a bare hash", () => {
    expect(normalizeTag("   ")).toBe("")
    expect(normalizeTag("#")).toBe("")
  })
})

describe("normalizeTags", () => {
  it("drops empties and de-duplicates, preserving first-seen order", () => {
    expect(normalizeTags(["B", "a", "", "  ", "b", "A"])).toEqual(["b", "a"])
  })

  it("collapses case and spacing variants onto one tag", () => {
    expect(normalizeTags(["Client Work", "client-work"])).toEqual(["client-work"])
  })

  it("returns an empty array for empty input", () => {
    expect(normalizeTags([])).toEqual([])
  })
})

describe("tagsFromFrontmatter", () => {
  it("handles an array", () => {
    expect(tagsFromFrontmatter(["Alpha", "beta"])).toEqual(["alpha", "beta"])
  })

  it("handles a comma-separated string", () => {
    expect(tagsFromFrontmatter("alpha, beta")).toEqual(["alpha", "beta"])
  })

  it("handles a space-separated string", () => {
    expect(tagsFromFrontmatter("alpha beta")).toEqual(["alpha", "beta"])
  })

  it("prefers comma splitting when both separators are present", () => {
    // "client work, urgent" is two tags, not three.
    expect(tagsFromFrontmatter("client work, urgent")).toEqual(["client-work", "urgent"])
  })

  it("strips hashes from Obsidian-style inline tags", () => {
    expect(tagsFromFrontmatter("#alpha #beta")).toEqual(["alpha", "beta"])
  })

  it("returns an empty array for null, undefined and empty string", () => {
    expect(tagsFromFrontmatter(null)).toEqual([])
    expect(tagsFromFrontmatter(undefined)).toEqual([])
    expect(tagsFromFrontmatter("")).toEqual([])
  })
})
