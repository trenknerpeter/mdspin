import { describe, it, expect } from "vitest"
import { clampLimit, clampOffset, escapeIlikeTerm, buildPage } from "@/lib/vault/query"

describe("clampLimit", () => {
  it("defaults when undefined", () => {
    expect(clampLimit(undefined)).toBe(20)
  })
  it("defaults on NaN / non-finite", () => {
    expect(clampLimit(NaN)).toBe(20)
    expect(clampLimit(Infinity)).toBe(20)
  })
  it("clamps below 1 up to 1", () => {
    expect(clampLimit(0)).toBe(1)
    expect(clampLimit(-5)).toBe(1)
  })
  it("clamps above max down to max", () => {
    expect(clampLimit(500)).toBe(100)
    expect(clampLimit(500, 10)).toBe(10)
  })
  it("truncates a fractional value", () => {
    expect(clampLimit(5.9)).toBe(5)
  })
})

describe("clampOffset", () => {
  it("defaults to 0 when undefined or non-finite", () => {
    expect(clampOffset(undefined)).toBe(0)
    expect(clampOffset(NaN)).toBe(0)
  })
  it("floors negative to 0", () => {
    expect(clampOffset(-10)).toBe(0)
  })
  it("truncates a fractional value", () => {
    expect(clampOffset(3.7)).toBe(3)
  })
})

describe("escapeIlikeTerm", () => {
  it("escapes % and _ so they are not treated as SQL LIKE wildcards", () => {
    expect(escapeIlikeTerm("100% done")).toBe("100\\% done")
    expect(escapeIlikeTerm("a_b")).toBe("a\\_b")
  })
  it("escapes a comma so it can't break an .or() filter list", () => {
    expect(escapeIlikeTerm("a,b")).toBe("a\\,b")
  })
  it("escapes backslashes first so % / _ escaping doesn't double-escape them", () => {
    expect(escapeIlikeTerm("a\\b")).toBe("a\\\\b")
    expect(escapeIlikeTerm("50\\%")).toBe("50\\\\\\%")
  })
})

describe("buildPage", () => {
  it("reports hasMore and nextOffset when more rows remain", () => {
    const page = buildPage([1, 2], { limit: 2, offset: 0, total: 5 })
    expect(page.page).toEqual({ limit: 2, offset: 0, total: 5, hasMore: true, nextOffset: 2 })
  })
  it("reports hasMore=false and nextOffset=null on the last page", () => {
    const page = buildPage([1], { limit: 2, offset: 4, total: 5 })
    expect(page.page).toEqual({ limit: 2, offset: 4, total: 5, hasMore: false, nextOffset: null })
  })
  it("handles an empty result set", () => {
    const page = buildPage([], { limit: 20, offset: 0, total: 0 })
    expect(page.data).toEqual([])
    expect(page.page.hasMore).toBe(false)
  })
})
