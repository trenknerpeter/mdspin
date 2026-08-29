// Embedding-backfill drainer (Stage 3). Mirrors app/api/vault/summaries/run/route.ts's
// claim-and-drain shape: one caller path claims a specific set of ids (bypasses the
// pending gate), the other claims up to `limit` pending docs via claim_pending_embeddings
// (FOR UPDATE SKIP LOCKED — safe against a second concurrent drain call). Unlike
// summaries, this route does its own chunking/embedding/writes rather than delegating to
// an external Make webhook, because the embedding model (Task 5's edge function) lives in
// this codebase's own infrastructure, not a third party's.

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { embedAndStoreDocument } from "@/lib/vault/embed-document"

export const runtime = "nodejs"
export const maxDuration = 60

const MAX_IDS = 10
// Lowered from 5: with EMBED_REQUEST_BATCH=1 (see lib/vault/limits.ts — the edge function
// hits a hard resource limit above batch size 1), a large document can need dozens of
// sequential embed calls. A handful of large documents claimed in one drain call could
// push total wall time past this route's maxDuration=60. The client-side drain loop
// (use-embedding-drain.ts) already re-calls this route repeatedly until nothing's left, so
// a smaller per-call limit just means more (cheap) round trips, not a slower backfill.
const DEFAULT_LIMIT = 2
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
    // embedding_claimed_at must be stamped here too, not just by claim_pending_embeddings:
    // that RPC's stale-reclaim check is `embedding_claimed_at < now() - interval
    // '10 minutes'`, which is NULL-false, so a doc claimed via {ids} whose status never
    // gets updated again (crash, timeout mid-loop) would be invisible to reclaim forever.
    const { data, error } = await supabase
      .from("conversions")
      .update({ embedding_status: "running", embedding_claimed_at: new Date().toISOString() })
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

  // One result per claimed doc, in processing order — this is what the client-side
  // checklist (use-embedding-drain.ts) renders as a live log of what just happened, not
  // just an aggregate count.
  const results: { id: string; label: string; ok: boolean }[] = []

  for (const doc of docs) {
    const ok = await embedAndStoreDocument(supabase, doc)
    results.push({ id: doc.id, label: doc.title || doc.filename, ok })
  }

  const { count: remaining } = await supabase
    .from("conversions")
    .select("id", { count: "exact", head: true })
    .eq("in_vault", true)
    .eq("embedding_status", "pending")

  return NextResponse.json({
    processed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    remaining: remaining ?? 0,
    results,
  })
}
