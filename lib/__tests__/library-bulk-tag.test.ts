import { describe, it, expect } from "vitest"
import { planTagAdditions } from "@/lib/library"

describe("planTagAdditions", () => {
  it("adds the normalized tag to every doc that doesn't already have it", () => {
    const targets = [
      { id: "d1", tags: ["x"] },
      { id: "d2", tags: [] },
    ]
    expect(planTagAdditions(targets, "New Tag")).toEqual([
      { id: "d1", tags: ["x", "new-tag"] },
      { id: "d2", tags: ["new-tag"] },
    ])
  })

  it("skips docs that already have the tag", () => {
    const targets = [
      { id: "d1", tags: ["new-tag"] },
      { id: "d2", tags: [] },
    ]
    expect(planTagAdditions(targets, "new-tag")).toEqual([{ id: "d2", tags: ["new-tag"] }])
  })

  it("returns nothing for a blank tag", () => {
    expect(planTagAdditions([{ id: "d1", tags: [] }], "   ")).toEqual([])
  })

  it("normalizes the same way typing it into the per-document tag input would", () => {
    const targets = [{ id: "d1", tags: [] }]
    expect(planTagAdditions(targets, "  Client Work ")).toEqual([{ id: "d1", tags: ["client-work"] }])
  })
})
