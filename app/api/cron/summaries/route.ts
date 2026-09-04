// Vercel Cron target for the per-doc summary backfill. Drains pending summaries across
// EVERY user, not just whoever has the vault page open — this is what makes summaries
// "automatic": a document is picked up by the next scheduled tick regardless of whether
// anyone ever opens the vault or clicks the per-document "Generate summary" button (which
// still exists as a do-it-now accelerator; this route doesn't replace it).
//
// This route is the fix for the pipeline's original failure. Before it existed, the drain
// branch of app/api/vault/summaries/run had zero callers anywhere in the repo, so
// summary_status='pending' meant "queued into a queue with no worker" and not one document
// in the vault had ever been summarised.
//
// Protected by CRON_SECRET, exactly like app/api/cron/embeddings: 503 when the secret
// isn't configured at all, 401 when it's wrong, never a silent unauthenticated drain.
//
// Uses claim_pending_summaries_global (service-role only, no per-user filter by design —
// see that migration's comment for why it must never be exposed to anon/authenticated).

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { summarizeAndStoreDocument, type SummarizableDoc } from "@/lib/vault/summarize-document"

export const runtime = "nodejs"
export const maxDuration = 60

// Each document is one Make webhook round trip, measured at ~4.5s against the live
// scenario, so 3 is ~14s — comfortably inside maxDuration=60 with room for a slow tail.
// A tick that times out mid-batch isn't a failure mode to fear: claimed docs past the
// 10-minute stale-claim window are reclaimed by the next tick automatically.
const CRON_LIMIT = 3

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: "NOT_CONFIGURED", message: "CRON_SECRET is not set." }, { status: 503 })
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const webhookUrl = process.env.MAKE_SUMMARY_WEBHOOK_URL
  if (!webhookUrl) {
    return NextResponse.json(
      { error: "NOT_CONFIGURED", message: "Summary generation is not configured." },
      { status: 503 }
    )
  }

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json(
      { error: "NOT_CONFIGURED", message: "Admin client is not configured." },
      { status: 503 }
    )
  }

  const { data, error } = await supabase.rpc("claim_pending_summaries_global", { p_limit: CRON_LIMIT })
  if (error) {
    return NextResponse.json({ error: "DB_ERROR", message: "Couldn't claim documents." }, { status: 500 })
  }
  const docs = (data ?? []) as SummarizableDoc[]

  const deps = { webhookUrl, webhookSecret: process.env.MAKE_SUMMARY_SECRET ?? "" }
  const results = []
  for (const doc of docs) {
    results.push(await summarizeAndStoreDocument(supabase, doc, deps))
  }

  return NextResponse.json({
    claimed: docs.length,
    processed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    // Includes the typed failure reason per document, so a scenario that starts returning
    // "Accepted" shows up in the cron log as unparseable_response instead of silence.
    results: results.map(({ id, label, ok, reason }) => ({ id, label, ok, reason })),
  })
}
