import { describe, it, expect } from "vitest"
import { buildResearchProjectPrompt } from "@/lib/mcp/prompts/researchProject"
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
    ...overrides,
  }
}

describe("buildResearchProjectPrompt", () => {
  it("throws NOT_FOUND for an unknown project", async () => {
    const repo = fakeRepo({ getProject: async () => null })
    await expect(buildResearchProjectPrompt(repo, "missing")).rejects.toThrow(/not found/i)
  })

  it("embeds the project's name, instructions, and the research procedure", async () => {
    const repo = fakeRepo({
      getProject: async () => ({ id: "p1", name: "Strategy", color: null, createdAt: "x", instructions: "Focus on pricing." }),
    })
    const result = await buildResearchProjectPrompt(repo, "p1")
    const text = result.messages[0].content.text
    expect(text).toContain("Strategy")
    expect(text).toContain("Focus on pricing.")
    expect(text).toContain("list_documents")
    expect(text).toContain("Cite every claim")
  })

  it("omits the instructions paragraph when the project has none", async () => {
    const repo = fakeRepo({
      getProject: async () => ({ id: "p1", name: "Strategy", color: null, createdAt: "x", instructions: null }),
    })
    const result = await buildResearchProjectPrompt(repo, "p1")
    expect(result.messages[0].content.text).not.toContain("Project instructions:")
  })
})
