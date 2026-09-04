import { describe, it, expect } from "vitest"
import { toSpin, projectIdsFromColumn, primaryProjectId, type Spin } from "@/lib/library"

function row(overrides: Partial<Parameters<typeof toSpin>[0]> = {}) {
  return {
    id: "doc-1",
    filename: "notes.md",
    title: null,
    file_type: "markdown",
    word_count: 42,
    project_id: null,
    tags: [],
    in_vault: true,
    source_type: "note" as const,
    converted_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-02T00:00:00Z",
    version: 1,
    brief: null,
    brief_generated_at: null,
    summary: null,
    summary_status: null,
    summary_generated_at: null,
    source_bytes: null,
    ...overrides,
  }
}

describe("toSpin", () => {
  it("passes the given projectIds through unchanged", () => {
    expect(toSpin(row(), ["proj-1"]).project_ids).toEqual(["proj-1"])
  })

  it("passes through more than one projectId — this is the whole point of Stage 5 Phase C", () => {
    expect(toSpin(row(), ["proj-1", "proj-2"]).project_ids).toEqual(["proj-1", "proj-2"])
  })

  it("collapses an omitted markdown_text (list query) to null", () => {
    const r = row()
    delete (r as { markdown_text?: string | null }).markdown_text
    expect(toSpin(r, []).markdown_text).toBeNull()
  })

  it("passes through a selected markdown_text (detail query)", () => {
    expect(toSpin(row({ markdown_text: "# Hello" }), []).markdown_text).toBe("# Hello")
  })

  it("maps every remaining field 1:1", () => {
    const spin = toSpin(
      row({ id: "d1", filename: "f.md", title: "T", file_type: "markdown", word_count: 9, version: 3 }),
      []
    )
    expect(spin).toMatchObject({ id: "d1", filename: "f.md", title: "T", file_type: "markdown", word_count: 9, version: 3 })
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

describe("primaryProjectId", () => {
  it("returns the first element of project_ids", () => {
    const spin: Pick<Spin, "project_ids"> = { project_ids: ["proj-1", "proj-2"] }
    expect(primaryProjectId(spin)).toBe("proj-1")
  })

  it("returns null for an empty project_ids array", () => {
    const spin: Pick<Spin, "project_ids"> = { project_ids: [] }
    expect(primaryProjectId(spin)).toBeNull()
  })
})
