import { describe, it, expect } from "vitest"
import { estimateTokenCount } from "@/lib/vault/tokens"

describe("estimateTokenCount", () => {
  it("estimates roughly 4 characters per token", () => {
    expect(estimateTokenCount("a".repeat(400))).toBe(100)
  })

  it("rounds up a partial token rather than truncating", () => {
    expect(estimateTokenCount("abc")).toBe(1)
  })

  it("returns 0 for empty text", () => {
    expect(estimateTokenCount("")).toBe(0)
  })
})
