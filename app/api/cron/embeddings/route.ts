// Vercel Cron target for the embedding backfill. Drains pending embeddings across EVERY
// user, not just whoever has the vault page open — this is what makes embedding
// "automatic": a document is picked up by the next scheduled tick regardless of whether
// anyone ever opens the vault or clicks the manual "Generate embeddings" button (which
// still exists as a do-it-now accelerator; this route doesn't replace it).
//
// Protected by CRON_SECRET: Vercel automatically sends `Authorization: Bearer
// $CRON_SECRET` on scheduled invocations when that env var is set on the project — see
// vercel.json for the schedule. Anyone hitting this route without the right secret gets a
// 401; anyone hitting it before CRON_SECRET is configured at all gets a 503, never a
// silent unauthenticated drain.
//
// Uses claim_pending_embeddings_global (service-role only, no per-user filter by design —
// see that migration's comment for why it must never be exposed to anon/authenticated).

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { embedAndStoreDocument, type EmbeddableDoc } from "@/lib/vault/embed-document"

export const runtime = "nodejs"
export const maxDuration = 60

// Conservative, same reasoning as the manual route's DEFAULT_LIMIT=2: with
// EMBED_REQUEST_BATCH=1, a handful of large documents can already approach maxDuration=60.
// A cron tick that times out mid-batch isn't a failure mode to fear (claimed docs past the
// 10-minute stale-claim window get reclaimed by the next tick automatically), but there's
// no reason to court it either.
const CRON_LIMIT = 3

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: "NOT_CONFIGURED", message: "CRON_SECRET is not set." }, { status: 503 })
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json(
      { error: "NOT_CONFIGURED", message: "Admin client is not configured." },
      { status: 503 }
    )
  }

  const { data, error } = await supabase.rpc("claim_pending_embeddings_global", { p_limit: CRON_LIMIT })
  if (error) {
    return NextResponse.json({ error: "DB_ERROR", message: "Couldn't claim documents." }, { status: 500 })
  }
  const docs = (data ?? []) as EmbeddableDoc[]

  let processed = 0
  let failed = 0
  for (const doc of docs) {
    const ok = await embedAndStoreDocument(supabase, doc)
    if (ok) processed++
    else failed++
  }

  return NextResponse.json({ claimed: docs.length, processed, failed })
}
