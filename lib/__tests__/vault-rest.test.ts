import { describe, it, expect } from "vitest"
import {
  documentToJson,
  projectToJson,
  relatedDocumentToJson,
  searchResultToJson,
  statsToJson,
  pageToJson,
} from "@/lib/vault/rest"
import type {
  VaultDocument,
  VaultProject,
  VaultRelatedDocument,
  VaultSearchResult,
  VaultStats,
  Page,
} from "@/lib/vault/types"

function doc(overrides: Partial<VaultDocument> = {}): VaultDocument {
  return {
    id: "doc-1",
    filename: "notes.md",
    title: "Notes",
    fileType: "markdown",
    wordCount: 42,
    projectIds: ["proj-1"],
    tags: ["a"],
    sourceType: "note",
    convertedAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-02T00:00:00Z",
    version: 1,
    markdown: null,
    summary: null,
    summaryStatus: "pending",
    ...overrides,
  }
}

describe("documentToJson", () => {
  it("renames every field to the snake_case wire format", () => {
    expect(documentToJson(doc())).toEqual({
      id: "doc-1",
      filename: "notes.md",
      title: "Notes",
      file_type: "markdown",
      word_count: 42,
      project_ids: ["proj-1"],
      tags: ["a"],
      source_type: "note",
      converted_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-02T00:00:00Z",
      version: 1,
      markdown_text: null,
    })
  })

  it("passes a populated markdown body through as markdown_text", () => {
    expect(documentToJson(doc({ markdown: "# Hello" })).markdown_text).toBe("# Hello")
  })
})

describe("projectToJson", () => {
  it("renames created_at", () => {
    const project: VaultProject = { id: "p1", name: "Strategy", color: "#FF4800", createdAt: "2026-08-01T00:00:00Z", instructions: null }
    expect(projectToJson(project)).toEqual({
      id: "p1",
      name: "Strategy",
      color: "#FF4800",
      created_at: "2026-08-01T00:00:00Z",
    })
  })
})

describe("relatedDocumentToJson", () => {
  it("renames fields including the singular project_id", () => {
    const related: VaultRelatedDocument = {
      id: "d2",
      filename: "f.md",
      title: null,
      fileType: "markdown",
      wordCount: 10,
      tags: [],
      projectId: "proj-1",
      convertedAt: "2026-08-01T00:00:00Z",
      rank: 0.42,
      strength: "strong",
    }
    expect(relatedDocumentToJson(related)).toEqual({
      id: "d2",
      filename: "f.md",
      title: null,
      file_type: "markdown",
      word_count: 10,
      tags: [],
      project_id: "proj-1",
      converted_at: "2026-08-01T00:00:00Z",
      rank: 0.42,
      strength: "strong",
    })
  })
})

describe("searchResultToJson", () => {
  it("spreads the document fields and adds rank + snippet", () => {
    const result: VaultSearchResult = { ...doc(), rank: 0.8, snippet: "...matched text..." }
    const json = searchResultToJson(result)
    expect(json.rank).toBe(0.8)
    expect(json.snippet).toBe("...matched text...")
    expect(json.file_type).toBe("markdown")
  })
})

describe("statsToJson", () => {
  it("renames every field", () => {
    const stats: VaultStats = { documentCount: 15, projectCount: 4, topTags: [{ tag: "pm", count: 5 }] }
    expect(statsToJson(stats)).toEqual({
      document_count: 15,
      project_count: 4,
      top_tags: [{ tag: "pm", count: 5 }],
    })
  })
})

describe("pageToJson", () => {
  it("maps each item and renames the page envelope", () => {
    const page: Page<VaultDocument> = {
      data: [doc()],
      page: { limit: 20, offset: 0, total: 1, hasMore: false, nextOffset: null },
    }
    expect(pageToJson(page, documentToJson)).toEqual({
      data: [documentToJson(doc())],
      page: { limit: 20, offset: 0, total: 1, has_more: false, next_offset: null },
    })
  })
})
