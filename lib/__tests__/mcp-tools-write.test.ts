import { describe, it, expect, vi } from "vitest"
import { runCreateDocument, runAppendToDocument, runUpdateDocument } from "@/lib/mcp/tools/write"
import type { VaultRepo } from "@/lib/vault/repo"
import { VaultError } from "@/lib/vault/errors"

function fakeRepo(overrides: Partial<VaultRepo> = {}): VaultRepo {
  return {
    listDocuments: vi.fn(),
    getDocument: vi.fn(),
    listProjects: vi.fn(),
    getProject: vi.fn(),
    getRelatedDocuments: vi.fn(),
    getStats: vi.fn(),
    searchDocuments: vi.fn(),
    updateDocument: vi.fn(),
    createDocument: vi.fn(),
    appendToDocument: vi.fn(),
    organizeDocument: vi.fn(),
    removeFromVault: vi.fn(),
    listDocumentsByCursor: vi.fn(),
    ...overrides,
  } as VaultRepo
}

const DOC = {
  id: "d1", filename: "f.md", title: "T", fileType: "md", wordCount: 2, projectIds: [], tags: [],
  sourceType: "mcp", convertedAt: "t", updatedAt: "t", version: 1, markdown: null, summary: null, summaryStatus: "pending",
}

describe("runCreateDocument", () => {
  it("passes title/markdown/tags/project_id through to repo.createDocument", async () => {
    const createDocument = vi.fn().mockResolvedValue(DOC)
    const repo = fakeRepo({ createDocument })
    const result = await runCreateDocument(repo, { title: "T", markdown: "body", tags: ["x"], project_id: "p1" })
    expect(createDocument).toHaveBeenCalledWith({ title: "T", markdown: "body", tags: ["x"], projectId: "p1" })
    expect(result).toMatchObject({ id: "d1", title: "T" })
  })
})

describe("runAppendToDocument", () => {
  it("calls repo.appendToDocument with actor mcp and the resolved key id", async () => {
    const appendToDocument = vi.fn().mockResolvedValue(DOC)
    const repo = fakeRepo({ appendToDocument })
    const ctx = { http: { authInfo: { clientId: "u1", extra: { keyId: "k1" } } } }
    await runAppendToDocument(repo, ctx, { document_id: "d1", addition: "more", reason: "note" })
    expect(appendToDocument).toHaveBeenCalledWith("d1", "more", { actor: "mcp", actorKeyId: "k1", reason: "note" })
  })
})

describe("runUpdateDocument", () => {
  it("builds a patch from only the provided fields and forces actor to mcp", async () => {
    const updateDocument = vi.fn().mockResolvedValue(DOC)
    const repo = fakeRepo({ updateDocument })
    const ctx = { http: { authInfo: { clientId: "u1", extra: { keyId: "k1" } } } }
    await runUpdateDocument(repo, ctx, { document_id: "d1", title: "New", expected_version: 3, reason: "fix typo" })
    expect(updateDocument).toHaveBeenCalledWith(
      "d1",
      { title: "New" },
      { expectedVersion: 3, actor: "mcp", actorKeyId: "k1", reason: "fix typo", confirmShrink: undefined }
    )
  })

  it("propagates a VaultError untouched (the tool handler, not this function, formats it)", async () => {
    const updateDocument = vi.fn().mockRejectedValue(new VaultError("IMMUTABLE_SOURCE", "no"))
    const repo = fakeRepo({ updateDocument })
    const ctx = { http: { authInfo: { clientId: "u1", extra: { keyId: "k1" } } } }
    await expect(
      runUpdateDocument(repo, ctx, { document_id: "d1", markdown: "x", expected_version: 1, reason: "r" })
    ).rejects.toBeInstanceOf(VaultError)
  })
})
