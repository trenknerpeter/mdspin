import { describe, it, expect } from "vitest"
import {
  compactDocMeta,
  compactProject,
  compactProjectDetail,
  compactRelated,
  compactSearchResult,
  compactStats,
  compactHeading,
} from "@/lib/mcp/format"
import type { VaultDocument, VaultProject, VaultRelatedDocument, VaultSearchResult, VaultStats } from "@/lib/vault/types"

function doc(overrides: Partial<VaultDocument> = {}): VaultDocument {
  return {
    id: "doc-1", filename: "notes.md", title: "Notes", fileType: "markdown", wordCount: 42,
    projectIds: ["proj-1"], tags: ["a"], sourceType: "note",
    convertedAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-02T00:00:00Z", version: 1,
    markdown: null, summary: null, summaryStatus: "pending",
    ...overrides,
  }
}

describe("compactDocMeta", () => {
  it("includes populated fields under compact names", () => {
    expect(compactDocMeta(doc())).toEqual({
      id: "doc-1", filename: "notes.md", title: "Notes", project_ids: ["proj-1"],
      tags: ["a"], word_count: 42, source_type: "note", updated_at: "2026-08-02T00:00:00Z", version: 1,
    })
  })
  it("omits empty project_ids and tags arrays rather than sending []", () => {
    const compact = compactDocMeta(doc({ projectIds: [], tags: [] }))
    expect(compact).not.toHaveProperty("project_ids")
    expect(compact).not.toHaveProperty("tags")
  })
  it("omits a null title rather than sending title: null", () => {
    expect(compactDocMeta(doc({ title: null }))).not.toHaveProperty("title")
  })
})

describe("compactProject", () => {
  it("never includes instructions, even if present on the domain object", () => {
    const project: VaultProject = {
      id: "p1", name: "Strategy", color: "#FF4800", createdAt: "2026-08-01T00:00:00Z",
      instructions: "Focus on pricing.",
    }
    expect(compactProject(project)).toEqual({ id: "p1", name: "Strategy", color: "#FF4800" })
  })
})

describe("compactProjectDetail", () => {
  it("includes instructions when present", () => {
    const project: VaultProject = {
      id: "p1", name: "Strategy", color: null, createdAt: "2026-08-01T00:00:00Z",
      instructions: "Focus on pricing.",
    }
    expect(compactProjectDetail(project)).toEqual({
      id: "p1", name: "Strategy", instructions: "Focus on pricing.", created_at: "2026-08-01T00:00:00Z",
    })
  })
  it("omits instructions when null", () => {
    const project: VaultProject = {
      id: "p1", name: "Strategy", color: null, createdAt: "2026-08-01T00:00:00Z", instructions: null,
    }
    expect(compactProjectDetail(project)).not.toHaveProperty("instructions")
  })
})

describe("compactRelated", () => {
  it("shapes a related-document row", () => {
    const related: VaultRelatedDocument = {
      id: "d2", filename: "f.md", title: null, fileType: "markdown", wordCount: 10,
      tags: [], projectId: "proj-1", convertedAt: "2026-08-01T00:00:00Z", rank: 0.42, strength: "strong",
    }
    expect(compactRelated(related)).toEqual({
      id: "d2", filename: "f.md", project_id: "proj-1", rank: 0.42, strength: "strong",
    })
  })
})

describe("compactSearchResult", () => {
  it("spreads doc meta and adds rank + snippet", () => {
    const result: VaultSearchResult = { ...doc(), rank: 0.8, snippet: "...matched..." }
    expect(compactSearchResult(result)).toEqual({
      id: "doc-1", filename: "notes.md", title: "Notes", project_ids: ["proj-1"], tags: ["a"],
      word_count: 42, source_type: "note", updated_at: "2026-08-02T00:00:00Z", version: 1,
      rank: 0.8, snippet: "...matched...",
    })
  })
})

describe("compactStats", () => {
  it("shapes stats, omitting an empty top_tags array", () => {
    const stats: VaultStats = { documentCount: 15, projectCount: 4, topTags: [] }
    expect(compactStats(stats)).toEqual({ document_count: 15, project_count: 4 })
  })
  it("includes top_tags when populated", () => {
    const stats: VaultStats = { documentCount: 15, projectCount: 4, topTags: [{ tag: "pm", count: 5 }] }
    expect(compactStats(stats)).toEqual({ document_count: 15, project_count: 4, top_tags: [{ tag: "pm", count: 5 }] })
  })
})

describe("compactHeading", () => {
  it("shapes a heading", () => {
    expect(compactHeading({ level: 2, text: "Pricing" })).toEqual({ level: 2, text: "Pricing" })
  })
})
