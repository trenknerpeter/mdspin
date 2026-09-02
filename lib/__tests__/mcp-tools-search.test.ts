import { describe, it, expect } from "vitest"
import { runSearch } from "@/lib/mcp/tools/search"
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

describe("runSearch", () => {
  it("clamps a requested limit above 25 down to 25", async () => {
    let seenLimit: number | undefined
    const repo = fakeRepo({
      searchDocuments: async (_q, opts) => {
        seenLimit = opts?.limit
        return { data: [], page: { limit: 25, offset: 0, total: 0, hasMore: false, nextOffset: null } }
      },
    })
    await runSearch(repo, { query: "pricing", limit: 999 })
    expect(seenLimit).toBe(25)
  })

  it("defaults to 10 when no limit is given", async () => {
    let seenLimit: number | undefined
    const repo = fakeRepo({
      searchDocuments: async (_q, opts) => {
        seenLimit = opts?.limit
        return { data: [], page: { limit: 10, offset: 0, total: 0, hasMore: false, nextOffset: null } }
      },
    })
    await runSearch(repo, { query: "pricing" })
    expect(seenLimit).toBe(10)
  })

  it("passes project_id and tags through to searchDocuments", async () => {
    let seenOpts: unknown
    const repo = fakeRepo({
      searchDocuments: async (_q, opts) => {
        seenOpts = opts
        return { data: [], page: { limit: 10, offset: 0, total: 0, hasMore: false, nextOffset: null } }
      },
    })
    await runSearch(repo, { query: "pricing", project_id: "proj-1", tags: ["pm"] })
    expect(seenOpts).toMatchObject({ projectId: "proj-1", tags: ["pm"] })
  })

  it("shapes each result via compactSearchResult and reports the total", async () => {
    const repo = fakeRepo({
      searchDocuments: async () => ({
        data: [{
          id: "d1", filename: "f.md", title: null, fileType: "markdown", wordCount: 1, projectIds: [],
          tags: [], sourceType: "note", convertedAt: "x", updatedAt: "2026-08-01T00:00:00Z", version: 1,
          markdown: null, summary: null, summaryStatus: "pending", rank: 0.5, snippet: "...",
        }],
        page: { limit: 10, offset: 0, total: 1, hasMore: false, nextOffset: null },
      }),
    })
    const result = await runSearch(repo, { query: "pricing" })
    expect(result.total).toBe(1)
    expect(result.results[0]).toMatchObject({ id: "d1", rank: 0.5, snippet: "..." })
  })
})
