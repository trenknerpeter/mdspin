import { describe, it, expect } from "vitest"
import { countTags } from "@/lib/library"

describe("countTags", () => {
  it("counts each tag across rows", () => {
    const rows = [{ tags: ["a", "b"] }, { tags: ["a"] }, { tags: [] }, { tags: null }]
    expect(countTags(rows)).toEqual([
      { tag: "a", count: 2 },
      { tag: "b", count: 1 },
    ])
  })

  it("sorts by count desc, then tag name asc", () => {
    const rows = [{ tags: ["zebra"] }, { tags: ["apple"] }, { tags: ["mango", "mango"] }]
    expect(countTags(rows)).toEqual([
      { tag: "mango", count: 2 },
      { tag: "apple", count: 1 },
      { tag: "zebra", count: 1 },
    ])
  })

  it("returns an empty array for no rows", () => {
    expect(countTags([])).toEqual([])
  })
})
