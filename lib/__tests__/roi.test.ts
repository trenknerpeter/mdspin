import { describe, it, expect } from "vitest"
import {
  estimateOriginalTokens,
  estimateMarkdownTokens,
  computeSavings,
  TEXT_DENSITY,
  DEFAULT_DENSITY,
} from "@/lib/roi"

describe("estimateOriginalTokens", () => {
  it("uses the per-format density", () => {
    // 10000 bytes * 0.35 (pdf) / 4 = 875
    expect(estimateOriginalTokens(10000, "pdf")).toBe(Math.round((10000 * TEXT_DENSITY.pdf) / 4))
  })

  it("is case-insensitive on the extension", () => {
    expect(estimateOriginalTokens(10000, "PDF")).toBe(estimateOriginalTokens(10000, "pdf"))
  })

  it("falls back to the default density for unknown formats", () => {
    expect(estimateOriginalTokens(8000, "xyz")).toBe(Math.round((8000 * DEFAULT_DENSITY) / 4))
  })
})

describe("estimateMarkdownTokens", () => {
  it("applies ~1.33 tokens per word", () => {
    expect(estimateMarkdownTokens(100)).toBe(133)
  })
})

describe("computeSavings", () => {
  it("clamps reduction to a 5–90 band when there's a positive original estimate", () => {
    expect(computeSavings({ origTokens: 1000, mdTokens: 5, monthlyCalls: 1 }).reductionPct).toBe(90)
    expect(computeSavings({ origTokens: 1000, mdTokens: 995, monthlyCalls: 1 }).reductionPct).toBe(5)
  })

  it("returns 0 reduction when there's no original estimate", () => {
    expect(computeSavings({ origTokens: 0, mdTokens: 0, monthlyCalls: 10 }).reductionPct).toBe(0)
  })

  it("scales monthly savings by reuse count and pricing", () => {
    // (1000 - 200) * 0.000015 * 20 = 0.24
    expect(computeSavings({ origTokens: 1000, mdTokens: 200, monthlyCalls: 20 }).monthlySavings).toBeCloseTo(0.24, 6)
  })
})
