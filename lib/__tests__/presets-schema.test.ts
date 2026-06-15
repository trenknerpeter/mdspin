import { describe, it, expect } from "vitest"
import { DEFAULT_OPTIONS, PRESET_OPTION_FIELDS } from "@/lib/presets"

describe("preset option schema", () => {
  it("has defaults for every declared field", () => {
    for (const field of PRESET_OPTION_FIELDS) {
      expect(DEFAULT_OPTIONS).toHaveProperty(field.key)
    }
  })
  it("frontmatter defaults to none", () => {
    expect(DEFAULT_OPTIONS.frontmatter).toBe("none")
  })
})
