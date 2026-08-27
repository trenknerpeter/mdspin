import { describe, it, expect } from "vitest"
import { nextEmbeddingStatus, buildChunkRows } from "@/lib/vault/embed-run"
import type { DocumentChunk } from "@/lib/vault/chunking"

describe("nextEmbeddingStatus", () => {
  it("returns ready on success regardless of attempt count", () => {
    expect(nextEmbeddingStatus(1, true)).toBe("ready")
  })
  it("returns pending on failure while under the attempt cap", () => {
    expect(nextEmbeddingStatus(2, false)).toBe("pending")
  })
  it("returns failed once the attempt cap is reached", () => {
    expect(nextEmbeddingStatus(3, false)).toBe("failed")
  })
})

describe("buildChunkRows", () => {
  const chunks: DocumentChunk[] = [
    { headingPath: "Intro", content: "hello", tokenCount: 1 },
    { headingPath: null, content: "world", tokenCount: 1 },
  ]
  const embeddings = [[0.1, 0.2], [0.3, 0.4]]

  it("zips chunks and embeddings into insertable rows, in order", () => {
    expect(buildChunkRows("doc-1", "user-1", chunks, embeddings)).toEqual([
      { document_id: "doc-1", user_id: "user-1", chunk_index: 0, heading_path: "Intro", content: "hello", token_count: 1, embedding: [0.1, 0.2] },
      { document_id: "doc-1", user_id: "user-1", chunk_index: 1, heading_path: null, content: "world", token_count: 1, embedding: [0.3, 0.4] },
    ])
  })

  it("throws on a length mismatch rather than silently misaligning text and vectors", () => {
    expect(() => buildChunkRows("doc-1", "user-1", chunks, [[0.1, 0.2]])).toThrow(/doc-1/)
  })
})
