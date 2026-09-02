import { describe, it, expect } from "vitest"
import { runListProjects, runGetProject, runGetRelatedDocuments } from "@/lib/mcp/tools/projects"
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
    ...overrides,
  }
}

describe("runListProjects", () => {
  it("shapes every project via compactProject (no instructions)", async () => {
    const repo = fakeRepo({
      listProjects: async () => [{ id: "p1", name: "Strategy", color: null, createdAt: "x", instructions: "secret notes" }],
    })
    const result = await runListProjects(repo)
    expect(result.projects).toEqual([{ id: "p1", name: "Strategy" }])
  })
})

describe("runGetProject", () => {
  it("includes instructions via compactProjectDetail", async () => {
    const repo = fakeRepo({
      getProject: async () => ({ id: "p1", name: "Strategy", color: null, createdAt: "x", instructions: "Focus on pricing." }),
    })
    const result = await runGetProject(repo, "p1")
    expect(result).toEqual({ id: "p1", name: "Strategy", instructions: "Focus on pricing.", created_at: "x" })
  })

  it("throws NOT_FOUND for a missing/foreign project", async () => {
    const repo = fakeRepo({ getProject: async () => null })
    await expect(runGetProject(repo, "missing")).rejects.toThrow(/not found/i)
  })
})

describe("runGetRelatedDocuments", () => {
  it("shapes each related document and forwards the limit", async () => {
    let seenLimit: number | undefined
    const repo = fakeRepo({
      getRelatedDocuments: async (_id: string, limit?: number) => {
        seenLimit = limit
        return [{
          id: "d2", filename: "f.md", title: null, fileType: "markdown", wordCount: 1,
          tags: [], projectId: "p1", convertedAt: "x", rank: 0.3, strength: "medium",
        }]
      },
    })
    const result = await runGetRelatedDocuments(repo, "d1", 5)
    expect(seenLimit).toBe(5)
    expect(result.related).toEqual([{ id: "d2", filename: "f.md", project_id: "p1", rank: 0.3, strength: "medium" }])
  })

  it("returns an empty array, not an error, when a document has no related docs", async () => {
    const repo = fakeRepo({ getRelatedDocuments: async () => [] })
    const result = await runGetRelatedDocuments(repo, "d1")
    expect(result.related).toEqual([])
  })
})
