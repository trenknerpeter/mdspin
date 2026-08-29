// I/O helper shared between the user-triggered drain route
// (app/api/vault/embeddings/run/route.ts) and the cron-triggered global drain
// (app/api/cron/embeddings/route.ts) — both chunk, embed, and store one document
// identically, so the logic lives in one place rather than two that can drift.

import type { SupabaseClient } from "@supabase/supabase-js"
import { chunkMarkdownByHeading } from "./chunking"
import { embedTexts } from "./embeddings"
import { buildChunkRows, nextEmbeddingStatus } from "./embed-run"
import { EMBED_REQUEST_BATCH, EMBED_BACKFILL_TIMEOUT_MS } from "./limits"

export interface EmbeddableDoc {
  id: string
  user_id: string
  title: string | null
  filename: string
  markdown_text: string | null
}

/**
 * Chunk, embed, and store one document's chunks, then update its embedding_status.
 * Returns whether it succeeded.
 *
 * Auth-agnostic by design: the caller supplies the Supabase client (per-request
 * cookie-authenticated for the manual drain route, service-role for the cron drain) — this
 * function only needs a client that can write document_chunks and update this doc's
 * conversions row, which both callers' clients can do (RLS for the former, bypass for the
 * latter).
 */
export async function embedAndStoreDocument(supabase: SupabaseClient, doc: EmbeddableDoc): Promise<boolean> {
  let ok = false
  try {
    // A re-embed (edited doc, or a manual {ids} retry) must not leave stale rows from a
    // previous version sitting alongside the new ones.
    await supabase.from("document_chunks").delete().eq("document_id", doc.id)

    const chunks = chunkMarkdownByHeading(doc.markdown_text ?? "")
    if (chunks.length === 0) {
      ok = true // an empty document has nothing to embed; that's not a failure
    } else {
      const allEmbeddings: number[][] = []
      for (let i = 0; i < chunks.length; i += EMBED_REQUEST_BATCH) {
        const slice = chunks.slice(i, i + EMBED_REQUEST_BATCH)
        const embeddings = await embedTexts(slice.map((c) => c.content), EMBED_BACKFILL_TIMEOUT_MS)
        if (!embeddings) throw new Error("embedding function unavailable")
        allEmbeddings.push(...embeddings)
      }
      const rows = buildChunkRows(doc.id, doc.user_id, chunks, allEmbeddings)
      const { error: insertError } = await supabase.from("document_chunks").insert(rows)
      if (insertError) throw new Error(insertError.message)
      ok = true
    }
  } catch {
    ok = false
  }

  if (ok) {
    await supabase
      .from("conversions")
      .update({ embedding_status: "ready", embedding_generated_at: new Date().toISOString() })
      .eq("id", doc.id)
  } else {
    const { data: current } = await supabase
      .from("conversions")
      .select("embedding_attempts")
      .eq("id", doc.id)
      .maybeSingle()
    const attempts = (current as { embedding_attempts: number } | null)?.embedding_attempts ?? 3
    await supabase
      .from("conversions")
      .update({ embedding_status: nextEmbeddingStatus(attempts, false) })
      .eq("id", doc.id)
  }

  return ok
}
