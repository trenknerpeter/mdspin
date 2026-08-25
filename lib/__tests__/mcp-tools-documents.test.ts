import { describe, it, expect } from "vitest"
import { buildGetDocumentResult } from "@/lib/mcp/tools/documents"
import type { VaultDocument } from "@/lib/vault/types"
import type { VaultRepo } from "@/lib/vault/repo"

function doc(overrides: Partial<VaultDocument> = {}): VaultDocument {
  return {
    id: "d1", filename: "f.md", title: "Notes", fileType: "markdown", wordCount: 5,
    projectIds: [], tags: [], sourceType: "note", convertedAt: "x", updatedAt: "2026-08-01T00:00:00Z",
    version: 1, markdown: null, summary: null, summaryStatus: "pending",
    ...overrides,
  }
}

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

describe("buildGetDocumentResult", () => {
  it("returns a not-found entry for a missing id without failing the whole batch", async () => {
    const repo = fakeRepo({ getDocument: async () => null })
    const result = await buildGetDocumentResult(repo, { document_ids: ["missing"] })
    expect(result.documents).toEqual([{ id: "missing", error: "not found" }])
  })

  it("content='none' returns metadata only, no summary/markdown/headings keys", async () => {
    const repo = fakeRepo({ getDocument: async () => doc() })
    const [entry] = (await buildGetDocumentResult(repo, { document_ids: ["d1"], content: "none" })).documents
    expect(entry).not.toHaveProperty("summary")
    expect(entry).not.toHaveProperty("markdown")
    expect(entry).not.toHaveProperty("headings")
  })

  it("content='summary' (the default) returns the summary when ready", async () => {
    const repo = fakeRepo({ getDocument: async () => doc({ summary: "A short summary.", summaryStatus: "ready" }) })
    const [entry] = (await buildGetDocumentResult(repo, { document_ids: ["d1"] })).documents
    expect(entry.summary).toBe("A short summary.")
    expect(entry.summary_status).toBe("ready")
  })

  it("content='summary' reports the status instead of a fake summary when not ready", async () => {
    const repo = fakeRepo({ getDocument: async () => doc({ summary: null, summaryStatus: "pending" }) })
    const [entry] = (await buildGetDocumentResult(repo, { document_ids: ["d1"], content: "summary" })).documents
    expect(entry.summary).toBeNull()
    expect(entry.summary_status).toBe("pending")
  })

  it("content='outline' extracts headings from the fetched markdown", async () => {
    const repo = fakeRepo({
      getDocument: async (_id, opts) => {
        expect(opts).toEqual({ includeMarkdown: true })
        return doc({ markdown: "# Title\n\ntext\n\n## Sub" })
      },
    })
    const [entry] = (await buildGetDocumentResult(repo, { document_ids: ["d1"], content: "outline" })).documents
    expect(entry.headings).toEqual([{ level: 1, text: "Title" }, { level: 2, text: "Sub" }])
  })

  it("content='full' slices markdown by offset/limit and reports content_range", async () => {
    const repo = fakeRepo({ getDocument: async () => doc({ markdown: "0123456789" }) })
    const [entry] = (
      await buildGetDocumentResult(repo, { document_ids: ["d1"], content: "full", offset: 2, limit: 3 })
    ).documents
    expect(entry.markdown).toBe("234")
    expect(entry.content_range).toEqual({ offset: 2, returned: 3, total: 10, truncated: true, next_offset: 5 })
  })

  it("content='full' reports truncated:false and next_offset:null when the slice reaches the end", async () => {
    const repo = fakeRepo({ getDocument: async () => doc({ markdown: "01234" }) })
    const [entry] = (
      await buildGetDocumentResult(repo, { document_ids: ["d1"], content: "full", offset: 0, limit: 100 })
    ).documents
    expect(entry.content_range).toEqual({ offset: 0, returned: 5, total: 5, truncated: false, next_offset: null })
  })

  it("defaults content to 'summary' and does not fetch markdown for it", async () => {
    let seenOpts: unknown
    const repo = fakeRepo({
      getDocument: async (_id, opts) => {
        seenOpts = opts
        return doc()
      },
    })
    await buildGetDocumentResult(repo, { document_ids: ["d1"] })
    expect(seenOpts).toEqual({ includeMarkdown: false })
  })

  it("fetches every requested id in the batch", async () => {
    const seen: string[] = []
    const repo = fakeRepo({
      getDocument: async (id) => {
        seen.push(id)
        return doc({ id })
      },
    })
    await buildGetDocumentResult(repo, { document_ids: ["a", "b", "c"] })
    expect(seen.sort()).toEqual(["a", "b", "c"])
  })
})
