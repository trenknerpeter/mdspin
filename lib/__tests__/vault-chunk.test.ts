import { describe, it, expect } from "vitest"
import { chunkBySize } from "@/lib/vault/chunk"

// Fixed-size items make the byte arithmetic readable.
const sizeOf = (n: number) => n

describe("chunkBySize", () => {
  it("returns an empty array for empty input", () => {
    expect(chunkBySize([], { maxCount: 5, maxBytes: 100, sizeOf })).toEqual([])
  })

  it("respects maxCount", () => {
    expect(chunkBySize([1, 1, 1, 1, 1], { maxCount: 2, maxBytes: 1000, sizeOf })).toEqual([
      [1, 1],
      [1, 1],
      [1],
    ])
  })

  it("respects maxBytes", () => {
    expect(chunkBySize([40, 40, 40], { maxCount: 100, maxBytes: 100, sizeOf })).toEqual([
      [40, 40],
      [40],
    ])
  })

  it("packs exactly up to the byte boundary without splitting early", () => {
    expect(chunkBySize([50, 50, 1], { maxCount: 100, maxBytes: 100, sizeOf })).toEqual([
      [50, 50],
      [1],
    ])
  })

  it("gives a single oversize item its own chunk rather than dropping it", () => {
    // The important property: nothing is silently lost, and there is no infinite loop.
    const out = chunkBySize([10, 500, 10], { maxCount: 100, maxBytes: 100, sizeOf })
    expect(out).toEqual([[10], [500], [10]])
    expect(out.flat()).toHaveLength(3)
  })

  it("handles an oversize item as the only input", () => {
    expect(chunkBySize([999], { maxCount: 10, maxBytes: 100, sizeOf })).toEqual([[999]])
  })

  it("handles consecutive oversize items", () => {
    expect(chunkBySize([999, 999], { maxCount: 10, maxBytes: 100, sizeOf })).toEqual([
      [999],
      [999],
    ])
  })

  it("never loses or duplicates items", () => {
    const items = Array.from({ length: 97 }, (_, i) => (i % 11) + 1)
    const flat = chunkBySize(items, { maxCount: 7, maxBytes: 25, sizeOf }).flat()
    expect(flat).toEqual(items)
  })

  it("clamps nonsensical limits instead of looping forever", () => {
    expect(chunkBySize([1, 2], { maxCount: 0, maxBytes: 0, sizeOf })).toEqual([[1], [2]])
  })

  it("measures UTF-8 byte length by default, not string length", () => {
    // "€" is 1 JS char but 3 UTF-8 bytes; JSON adds 2 quote chars => 5 bytes each.
    const out = chunkBySize(["€", "€"], { maxCount: 100, maxBytes: 9 })
    expect(out).toEqual([["€"], ["€"]])
  })
})
