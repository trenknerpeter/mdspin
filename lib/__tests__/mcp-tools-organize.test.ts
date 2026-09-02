import { describe, it, expect, vi } from "vitest"
import { runOrganizeDocument, runRemoveFromVault } from "@/lib/mcp/tools/organize"
import type { VaultRepo } from "@/lib/vault/repo"

function fakeRepo(overrides: Partial<VaultRepo> = {}): VaultRepo {
  return {
    listDocuments: vi.fn(), getDocument: vi.fn(), listProjects: vi.fn(), getProject: vi.fn(),
    getRelatedDocuments: vi.fn(), getStats: vi.fn(), searchDocuments: vi.fn(), updateDocument: vi.fn(),
    createDocument: vi.fn(), appendToDocument: vi.fn(), organizeDocument: vi.fn(), removeFromVault: vi.fn(),
    listDocumentsByCursor: vi.fn(),
    ...overrides,
  } as VaultRepo
}

const DOC = {
  id: "d1", filename: "f.md", title: "T", fileType: "md", wordCount: 2, projectIds: [], tags: ["a"],
  sourceType: "mcp", convertedAt: "t", updatedAt: "t", version: 2, markdown: null, summary: null, summaryStatus: "pending",
}

describe("runOrganizeDocument", () => {
  it("passes add_tags/remove_tags through with actor mcp and the resolved key id", async () => {
    const organizeDocument = vi.fn().mockResolvedValue(DOC)
    const repo = fakeRepo({ organizeDocument })
    const ctx = { http: { authInfo: { clientId: "u1", extra: { keyId: "k1" } } } }
    const result = await runOrganizeDocument(repo, ctx, { document_id: "d1", add_tags: ["a"], remove_tags: ["b"], reason: "cleanup" })
    expect(organizeDocument).toHaveBeenCalledWith("d1", { addTags: ["a"], removeTags: ["b"], actor: "mcp", actorKeyId: "k1", reason: "cleanup" })
    expect(result).toMatchObject({ id: "d1", tags: ["a"] })
  })
})

describe("runRemoveFromVault", () => {
  it("calls repo.removeFromVault and returns a confirmation shape", async () => {
    const removeFromVault = vi.fn().mockResolvedValue(undefined)
    const repo = fakeRepo({ removeFromVault })
    const result = await runRemoveFromVault(repo, { document_id: "d1" })
    expect(removeFromVault).toHaveBeenCalledWith("d1")
    expect(result).toEqual({ id: "d1", removed: true })
  })
})
