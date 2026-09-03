import { describe, it, expect } from "vitest"
import { buildProjectPatchPayload, projectIdsFromColumn, toVaultDocument, toVaultProject, type ConversionRow, type ProjectRow } from "@/lib/vault/mappers"

function row(overrides: Partial<ConversionRow> = {}): ConversionRow {
  return {
    id: "doc-1",
    filename: "notes.md",
    title: null,
    file_type: "markdown",
    word_count: 42,
    project_id: null,
    tags: null,
    source_type: "note",
    converted_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-02T00:00:00Z",
    version: 1,
    ...overrides,
  }
}

describe("toVaultDocument", () => {
  it("passes the given projectIds through unchanged", () => {
    expect(toVaultDocument(row(), ["proj-1"]).projectIds).toEqual(["proj-1"])
  })

  it("passes through an empty projectIds array", () => {
    expect(toVaultDocument(row(), []).projectIds).toEqual([])
  })

  it("passes through more than one projectId — this is the whole point of Stage 5 Phase B", () => {
    expect(toVaultDocument(row(), ["proj-1", "proj-2"]).projectIds).toEqual(["proj-1", "proj-2"])
  })

  it("defaults a null tags column to an empty array", () => {
    expect(toVaultDocument(row({ tags: null }), []).tags).toEqual([])
  })

  it("collapses an omitted markdown_text (list query) to null", () => {
    const r = row()
    delete (r as { markdown_text?: string | null }).markdown_text
    expect(toVaultDocument(r, []).markdown).toBeNull()
  })

  it("passes through a selected markdown_text (detail query)", () => {
    expect(toVaultDocument(row({ markdown_text: "# Hello" }), []).markdown).toBe("# Hello")
  })

  it("maps every remaining field 1:1 with the expected renames", () => {
    const doc = toVaultDocument(
      row({ id: "d1", filename: "f.md", title: "T", file_type: "markdown", word_count: 9, source_type: "note", version: 3 }),
      []
    )
    expect(doc).toMatchObject({
      id: "d1",
      filename: "f.md",
      title: "T",
      fileType: "markdown",
      wordCount: 9,
      sourceType: "note",
      version: 3,
    })
  })

  it("maps summary and summary_status, defaulting summary_status to pending when absent", () => {
    const withSummary = toVaultDocument(row({ summary: "A short summary.", summary_status: "ready" }), [])
    expect(withSummary.summary).toBe("A short summary.")
    expect(withSummary.summaryStatus).toBe("ready")

    const withoutSummary = toVaultDocument(row(), [])
    expect(withoutSummary.summary).toBeNull()
    expect(withoutSummary.summaryStatus).toBe("pending")
  })
})

describe("projectIdsFromColumn", () => {
  it("wraps a non-null project_id into a one-element array", () => {
    expect(projectIdsFromColumn({ project_id: "proj-1" })).toEqual(["proj-1"])
  })

  it("maps a null project_id to an empty array, not [null]", () => {
    expect(projectIdsFromColumn({ project_id: null })).toEqual([])
  })
})

describe("toVaultProject", () => {
  it("maps a project row 1:1 with the expected rename", () => {
    const p: ProjectRow = { id: "p1", name: "Strategy", color: "#FF4800", created_at: "2026-08-01T00:00:00Z" }
    expect(toVaultProject(p)).toEqual({
      id: "p1",
      name: "Strategy",
      color: "#FF4800",
      createdAt: "2026-08-01T00:00:00Z",
      instructions: null,
    })
  })

  it("passes through a null color", () => {
    const p: ProjectRow = { id: "p1", name: "Strategy", color: null, created_at: "2026-08-01T00:00:00Z" }
    expect(toVaultProject(p).color).toBeNull()
  })

  it("maps instructions, defaulting to null when absent", () => {
    const withInstructions: ProjectRow = {
      id: "p1", name: "Strategy", color: null, created_at: "2026-08-01T00:00:00Z",
      instructions: "Focus on pricing.",
    }
    expect(toVaultProject(withInstructions).instructions).toBe("Focus on pricing.")

    const withoutInstructions: ProjectRow = {
      id: "p1", name: "Strategy", color: null, created_at: "2026-08-01T00:00:00Z",
    }
    expect(toVaultProject(withoutInstructions).instructions).toBeNull()
  })
})

describe("buildProjectPatchPayload", () => {
  it("includes only the keys present in the patch", () => {
    expect(buildProjectPatchPayload({ name: "New Name" })).toEqual({ name: "New Name" })
    expect(buildProjectPatchPayload({ color: null })).toEqual({ color: null })
    expect(buildProjectPatchPayload({ name: "New Name", instructions: "Focus on X." })).toEqual({
      name: "New Name",
      instructions: "Focus on X.",
    })
  })

  it("returns an empty object for an empty patch", () => {
    expect(buildProjectPatchPayload({})).toEqual({})
  })
})
