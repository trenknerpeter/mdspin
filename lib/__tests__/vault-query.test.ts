import { describe, it, expect } from "vitest"
import { clampLimit, clampOffset, escapeIlikeTerm, buildPage, parseTagsParam, parseNumberParam, isValidUuid, isValidTimestamp } from "@/lib/vault/query"

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

describe("isValidUuid", () => {
  it("accepts a well-formed v4 uuid", () => {
    expect(isValidUuid("d4444ca9-8046-47a2-af55-11079f0e824f")).toBe(true)
  })
  it("accepts an uppercase uuid — hex is case-insensitive", () => {
    expect(isValidUuid("D4444CA9-8046-47A2-AF55-11079F0E824F")).toBe(true)
  })
  it("rejects obvious garbage", () => {
    expect(isValidUuid("zzz")).toBe(false)
    expect(isValidUuid("")).toBe(false)
  })
  it("rejects a uuid missing a segment", () => {
    expect(isValidUuid("d4444ca9-8046-47a2-11079f0e824f")).toBe(false)
  })
  it("rejects non-hex characters and wrong-length segments", () => {
    expect(isValidUuid("g4444ca9-8046-47a2-af55-11079f0e824f")).toBe(false)
    expect(isValidUuid("d4444ca9-80466-47a2-af55-11079f0e824")).toBe(false)
  })
  it("rejects a uuid with surrounding whitespace or trailing junk", () => {
    expect(isValidUuid(" d4444ca9-8046-47a2-af55-11079f0e824f")).toBe(false)
    expect(isValidUuid("d4444ca9-8046-47a2-af55-11079f0e824f'")).toBe(false)
  })
})

describe("isValidTimestamp", () => {
  it("accepts a Z-suffixed timestamp", () => {
    expect(isValidTimestamp("2026-08-01T00:00:00.123456Z")).toBe(true)
  })
  it("accepts a timezone-offset timestamp", () => {
    expect(isValidTimestamp("2026-08-01T00:00:00+00:00")).toBe(true)
  })
  it("rejects a filter-injection attempt smuggled in as a timestamp", () => {
    expect(isValidTimestamp("2026-08-01T00:00:00Z,and(1.eq.1)")).toBe(false)
  })
  it("rejects garbage", () => {
    expect(isValidTimestamp("not-a-date")).toBe(false)
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

describe("parseTagsParam", () => {
  it("returns undefined for null", () => {
    expect(parseTagsParam(null)).toBeUndefined()
  })
  it("returns undefined for an empty string", () => {
    expect(parseTagsParam("")).toBeUndefined()
  })
  it("splits, trims, and drops empty segments", () => {
    expect(parseTagsParam("a, b ,, c")).toEqual(["a", "b", "c"])
  })
  it("returns undefined when every segment is empty", () => {
    expect(parseTagsParam(",, ,")).toBeUndefined()
  })
})

describe("parseNumberParam", () => {
  it("returns undefined for null", () => {
    expect(parseNumberParam(null)).toBeUndefined()
  })
  it("returns undefined for an empty or whitespace string", () => {
    expect(parseNumberParam("")).toBeUndefined()
    expect(parseNumberParam("  ")).toBeUndefined()
  })
  it("parses a valid integer string", () => {
    expect(parseNumberParam("42")).toBe(42)
  })
  it("returns NaN for a garbage string, for the caller's clamp to catch", () => {
    expect(parseNumberParam("abc")).toBeNaN()
  })
})
