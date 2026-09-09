import { describe, it, expect } from "vitest"
import { idsInRange } from "@/lib/library"

const ORDER = ["a", "b", "c", "d", "e"]

describe("idsInRange", () => {
  it("returns the inclusive span between two rows", () => {
    expect(idsInRange(ORDER, "b", "d")).toEqual(["b", "c", "d"])
  })

  it("works when the range is dragged upwards", () => {
    expect(idsInRange(ORDER, "d", "b")).toEqual(["b", "c", "d"])
  })

  it("returns a single id when both ends are the same row", () => {
    expect(idsInRange(ORDER, "c", "c")).toEqual(["c"])
  })

  it("spans the whole list from first to last", () => {
    expect(idsInRange(ORDER, "a", "e")).toEqual(ORDER)
  })

  it("falls back to a plain click when the anchor is no longer in the list", () => {
    expect(idsInRange(ORDER, "gone", "c")).toEqual(["c"])
  })

  it("falls back when the target is missing too", () => {
    expect(idsInRange(ORDER, "a", "gone")).toEqual(["gone"])
  })

  it("handles an empty list without throwing", () => {
    expect(idsInRange([], "a", "b")).toEqual(["b"])
  })
})
