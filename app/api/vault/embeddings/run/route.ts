// Embedding-backfill drainer (Stage 3). Mirrors app/api/vault/summaries/run/route.ts's
// claim-and-drain shape: one caller path claims a specific set of ids (bypasses the
// pending gate), the other claims up to `limit` pending docs via claim_pending_embeddings
// (FOR UPDATE SKIP LOCKED — safe against a second concurrent drain call). Unlike
// summaries, this route does its own chunking/embedding/writes rather than delegating to
// an external Make webhook, because the embedding model (Task 5's edge function) lives in
// this codebase's own infrastructure, not a third party's.

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { chunkMarkdownByHeading } from "@/lib/vault/chunking"
import { embedTexts } from "@/lib/vault/embeddings"
import { buildChunkRows, nextEmbeddingStatus } from "@/lib/vault/embed-run"
import { EMBED_REQUEST_BATCH } from "@/lib/vault/limits"

export const runtime = "nodejs"
export const maxDuration = 60

const MAX_IDS = 10
const DEFAULT_LIMIT = 5
const MAX_LIMIT = 20

interface ClaimedDoc {
  id: string
  user_id: string
  title: string | null
  filename: string
  markdown_text: string | null
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "AUTH_REQUIRED", message: "Sign in first." }, { status: 401 })
  }

  let body: { ids?: string[]; limit?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "INVALID_REQUEST", message: "Body must be JSON." }, { status: 400 })
  }

  let docs: ClaimedDoc[]

  if (body.ids?.length) {
    const ids = body.ids.slice(0, MAX_IDS)
    const { data, error } = await supabase
      .from("conversions")
      .update({ embedding_status: "running" })
      .in("id", ids)
      .eq("in_vault", true)
      .select("id, user_id, title, filename, markdown_text")
    if (error) {
      return NextResponse.json({ error: "DB_ERROR", message: "Couldn't claim documents." }, { status: 500 })
    }
    docs = (data ?? []) as ClaimedDoc[]
  } else {
    const limit = Math.min(Math.max(body.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
    const { data, error } = await supabase.rpc("claim_pending_embeddings", { p_limit: limit })
    if (error) {
      return NextResponse.json({ error: "DB_ERROR", message: "Couldn't claim documents." }, { status: 500 })
    }
    docs = (data ?? []) as ClaimedDoc[]
  }

  let processed = 0
  let failed = 0

  for (const doc of docs) {
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
          const embeddings = await embedTexts(slice.map((c) => c.content))
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
      processed++
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
      failed++
    }
  }

  const { count: remaining } = await supabase
    .from("conversions")
    .select("id", { count: "exact", head: true })
    .eq("in_vault", true)
    .eq("embedding_status", "pending")

  return NextResponse.json({ processed, failed, remaining: remaining ?? 0 })
}
