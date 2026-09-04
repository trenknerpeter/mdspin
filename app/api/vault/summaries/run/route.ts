// Per-doc summary drainer. Two callers, one handler: the detail panel's "Summarize" /
// "Regenerate" button ({ids:[id]}), and the vault-wide backfill banner ({limit}).
//
// The actual summarising lives in lib/vault/summarize-document.ts, shared with the cron
// drain (app/api/cron/summaries) so the two can't drift — and so it's unit-testable, which
// route handlers are not under this repo's vitest config.
//
// Both branches claim through an RPC rather than a plain .update(). That is not incidental:
// PostgREST cannot express `summary_attempts = summary_attempts + 1`, so the old inline
// update left attempts pinned at 0, nextSummaryStatus could never return 'failed', and a
// completely broken webhook was indistinguishable from "nobody clicked". See
// 20260904000002_claim_summaries_by_id.sql.

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { summarizeAndStoreDocument, type SummarizableDoc } from "@/lib/vault/summarize-document"

export const runtime = "nodejs"
export const maxDuration = 60

const WEBHOOK_URL = process.env.MAKE_SUMMARY_WEBHOOK_URL
const WEBHOOK_SECRET = process.env.MAKE_SUMMARY_SECRET ?? ""
const MAX_IDS = 10
const DEFAULT_LIMIT = 5
const MAX_LIMIT = 20

export async function POST(req: NextRequest) {
  if (!WEBHOOK_URL) {
    return NextResponse.json(
      { error: "NOT_CONFIGURED", message: "Summary generation is not configured." },
      { status: 503 }
    )
  }

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

  let docs: SummarizableDoc[]

  if (body.ids?.length) {
    // Manual Summarize/Regenerate: bypasses the pending gate (so a 'ready' doc can be
    // regenerated), scoped to the caller's own in-vault docs by the RPC's auth.uid() filter.
    const { data, error } = await supabase.rpc("claim_summaries_by_id", {
      p_ids: body.ids.slice(0, MAX_IDS),
    })
    if (error) {
      return NextResponse.json({ error: "DB_ERROR", message: "Couldn't claim documents." }, { status: 500 })
    }
    docs = (data ?? []) as SummarizableDoc[]
  } else {
    const limit = Math.min(Math.max(body.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
    const { data, error } = await supabase.rpc("claim_pending_summaries", { p_limit: limit })
    if (error) {
      return NextResponse.json({ error: "DB_ERROR", message: "Couldn't claim documents." }, { status: 500 })
    }
    docs = (data ?? []) as SummarizableDoc[]
  }

  const deps = { webhookUrl: WEBHOOK_URL, webhookSecret: WEBHOOK_SECRET }
  const results = []
  for (const doc of docs) {
    results.push(await summarizeAndStoreDocument(supabase, doc, deps))
  }

  const { count: remaining } = await supabase
    .from("conversions")
    .select("id", { count: "exact", head: true })
    .eq("in_vault", true)
    .eq("summary_status", "pending")

  const summaries = results
    .filter((r) => r.ok && r.summary)
    .map((r) => ({ id: r.id, summary: r.summary as string }))

  return NextResponse.json({
    processed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    remaining: remaining ?? 0,
    summaries,
    // Per-doc outcomes with a typed failure reason: powers the drain checklist and lets the
    // detail panel say WHY a summary failed instead of one blanket "try again".
    results: results.map(({ id, label, ok, reason }) => ({ id, label, ok, reason })),
    summary_generated_at: new Date().toISOString(),
  })
}
