import { describe, it, expect } from "vitest"
import { mergeRelatedSpins, type RelatedSpin } from "@/lib/library"

const mk = (id: string, rank: number): RelatedSpin => ({
  id,
  filename: `${id}.md`,
  title: id,
  file_type: "md",
  word_count: 1,
  tags: [],
  project_id: null,
  converted_at: "2026-06-18T00:00:00Z",
  rank,
})

describe("mergeRelatedSpins", () => {
  it("dedupes by id keeping the higher rank", () => {
    const out = mergeRelatedSpins([[mk("a", 0.2)], [mk("a", 0.9)]], [], 5)
    expect(out).toHaveLength(1)
    expect(out[0].rank).toBe(0.9)
  })

  it("excludes ids in excludeIds", () => {
    const out = mergeRelatedSpins([[mk("a", 0.5), mk("b", 0.4)]], ["a"], 5)
    expect(out.map((s) => s.id)).toEqual(["b"])
  })

  it("sorts by rank desc and caps at max", () => {
    const out = mergeRelatedSpins([[mk("a", 0.1), mk("b", 0.9), mk("c", 0.5)]], [], 2)
    expect(out.map((s) => s.id)).toEqual(["b", "c"])
  })

  it("returns [] for empty input", () => {
    expect(mergeRelatedSpins([], [], 5)).toEqual([])
  })

  it("treats a missing rank as 0 and still returns the item", () => {
    const noRank: RelatedSpin = { ...mk("z", 0), rank: undefined }
    const out = mergeRelatedSpins([[noRank, mk("a", 0.5)]], [], 5)
    expect(out.map((s) => s.id)).toEqual(["a", "z"])
  })
})
