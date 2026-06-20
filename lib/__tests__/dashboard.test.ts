import { describe, it, expect } from "vitest"
import {
  computeDashboardStats,
  computeActivitySeries,
  computeCumulativeSavings,
  type DashboardRow,
} from "@/lib/dashboard"

const NOW = new Date(2026, 5, 20) // 2026-06-20 (local)

function row(partial: Partial<DashboardRow>): DashboardRow {
  return {
    converted_at: "2026-06-19T10:00:00.000Z",
    word_count: 100,
    file_type: "pdf",
    source_bytes: 10000,
    brief_generated_at: null,
    in_vault: false,
    ...partial,
  }
}

describe("computeDashboardStats", () => {
  it("counts totals, this-month, words, briefs, and vault membership", () => {
    const rows = [
      row({ converted_at: "2026-06-10T00:00:00Z", word_count: 100, in_vault: true, brief_generated_at: "x" }),
      row({ converted_at: "2026-06-02T00:00:00Z", word_count: 50, in_vault: false }),
      row({ converted_at: "2026-05-20T00:00:00Z", word_count: 25, in_vault: true }), // last month
    ]
    const s = computeDashboardStats(rows, NOW)
    expect(s.totalSpins).toBe(3)
    expect(s.spinsThisMonth).toBe(2)
    expect(s.totalWords).toBe(175)
    expect(s.briefsGenerated).toBe(1)
    expect(s.vaultCount).toBe(2)
  })
})

describe("computeActivitySeries", () => {
  it("returns one zero-filled bucket per day, oldest→newest", () => {
    const series = computeActivitySeries([], 30, NOW)
    expect(series).toHaveLength(30)
    expect(series[29].date).toBe("2026-06-20")
    expect(series.every((p) => p.count === 0)).toBe(true)
  })

  it("buckets spins onto their local day and ignores out-of-window rows", () => {
    const rows = [
      row({ converted_at: "2026-06-20T08:00:00" }),
      row({ converted_at: "2026-06-20T20:00:00" }),
      row({ converted_at: "2025-01-01T00:00:00" }), // far outside the window
    ]
    const series = computeActivitySeries(rows, 30, NOW)
    expect(series[series.length - 1]).toEqual({ date: "2026-06-20", count: 2 })
  })
})

describe("computeCumulativeSavings", () => {
  it("excludes rows without source_bytes and tracks the earliest contributing date", () => {
    const rows = [
      row({ source_bytes: 10000, word_count: 100, converted_at: "2026-06-18T00:00:00Z" }),
      row({ source_bytes: null, word_count: 999, converted_at: "2026-06-01T00:00:00Z" }), // excluded
    ]
    const s = computeCumulativeSavings(rows, 20)
    expect(s.trackedCount).toBe(1)
    expect(s.trackedFrom).toBe("2026-06-18T00:00:00Z")
    expect(s.tokensSaved).toBeGreaterThan(0)
  })

  it("is all zero when no row has source_bytes", () => {
    const s = computeCumulativeSavings([row({ source_bytes: null })], 20)
    expect(s).toMatchObject({ tokensSaved: 0, monthlySavings: 0, reductionPct: 0, trackedFrom: null, trackedCount: 0 })
  })
})
