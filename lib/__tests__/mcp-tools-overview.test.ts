import { describe, it, expect } from "vitest"
import { buildOverview } from "@/lib/mcp/tools/overview"
import type { VaultRepo } from "@/lib/vault/repo"

function fakeRepo(overrides: Partial<VaultRepo> = {}): VaultRepo {
  return {
    listDocuments: async () => ({ data: [], page: { limit: 10, offset: 0, total: 0, hasMore: false, nextOffset: null } }),
    getDocument: async () => null,
    listProjects: async () => [],
    getProject: async () => null,
    getRelatedDocuments: async () => [],
    getStats: async () => ({ documentCount: 0, projectCount: 0, topTags: [] }),
    searchDocuments: async () => ({ data: [], page: { limit: 20, offset: 0, total: 0, hasMore: false, nextOffset: null } }),
    listDocumentsByCursor: async () => ({ data: [], nextCursor: null }),
    updateDocument: async () => {
      throw new Error("not used in this test")
    },
    createDocument: async () => {
      throw new Error("not used in this test")
    },
    appendToDocument: async () => {
      throw new Error("not used in this test")
    },
    organizeDocument: async () => {
      throw new Error("not used in this test")
    },
    removeFromVault: async () => {
      throw new Error("not used in this test")
    },
    createProject: async () => {
      throw new Error("not used in this test")
    },
    updateProject: async () => {
      throw new Error("not used in this test")
    },
    ...overrides,
  }
}

describe("buildOverview", () => {
  it("combines stats, projects (no counts), and the 10 most recent documents", async () => {
    const repo = fakeRepo({
      getStats: async () => ({ documentCount: 15, projectCount: 4, topTags: [{ tag: "pm", count: 5 }] }),
      listProjects: async () => [{ id: "p1", name: "Strategy", color: null, createdAt: "x", instructions: null }],
      listDocuments: async (filter: { limit: number }) => {
        expect(filter).toEqual({ limit: 10 })
        return {
          data: [{
            id: "d1", filename: "f.md", title: "Notes", fileType: "markdown", wordCount: 5,
            projectIds: [], tags: [], sourceType: "note", convertedAt: "x",
            updatedAt: "2026-08-01T00:00:00Z", version: 1, markdown: null, summary: null, summaryStatus: "pending",
          }],
          page: { limit: 10, offset: 0, total: 1, hasMore: false, nextOffset: null },
        }
      },
    })
    const overview = await buildOverview(repo)
    expect(overview.document_count).toBe(15)
    expect(overview.projects).toEqual([{ id: "p1", name: "Strategy" }])
    expect(overview.recent).toHaveLength(1)
    expect(overview.recent[0].id).toBe("d1")
  })
})
