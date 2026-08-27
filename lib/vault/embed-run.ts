// lib/vault/embed-run.ts
//
// Pure helpers for the embedding-backfill pipeline (Stage 3). Mirrors summary.ts's
// pure/IO split — the route handler (Task 8) owns the claim RPC, the edge-function fetch,
// and the writes.

import type { DocumentChunk } from "./chunking"
import { EMBEDDING_MAX_ATTEMPTS } from "./limits"

export type EmbeddingStatus = "pending" | "running" | "ready" | "failed"

/** Same retry state machine as nextSummaryStatus (lib/vault/summary.ts): bounded retries,
 *  the next drain picks up anything still `pending`. `attempts` is the count AFTER the
 *  attempt being recorded. */
export function nextEmbeddingStatus(attempts: number, ok: boolean): EmbeddingStatus {
  if (ok) return "ready"
  return attempts >= EMBEDDING_MAX_ATTEMPTS ? "failed" : "pending"
}

export interface ChunkRow {
  document_id: string
  user_id: string
  chunk_index: number
  heading_path: string | null
  content: string
  token_count: number
  embedding: number[]
}

/**
 * Zip a document's chunks with their embeddings (same order, same length — the caller
 * requests exactly one embedding per chunk.content in each edge-function call) into
 * insertable document_chunks rows. Throws on a length mismatch rather than silently
 * misaligning chunk N's text with chunk M's vector — that would be a wrong-but-plausible
 * search result with no error anywhere to catch it.
 */
export function buildChunkRows(
  documentId: string,
  userId: string,
  chunks: DocumentChunk[],
  embeddings: number[][]
): ChunkRow[] {
  if (chunks.length !== embeddings.length) {
    throw new Error(
      `buildChunkRows: ${chunks.length} chunks but ${embeddings.length} embeddings for document ${documentId}.`
    )
  }
  return chunks.map((chunk, i) => ({
    document_id: documentId,
    user_id: userId,
    chunk_index: i,
    heading_path: chunk.headingPath,
    content: chunk.content,
    token_count: chunk.tokenCount,
    embedding: embeddings[i],
  }))
}
