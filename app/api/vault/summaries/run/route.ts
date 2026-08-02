// Per-doc summary drainer. Three callers, one handler: the detail panel's
// "Summarize" button ({ids:[id]}), a future backfill banner ({limit}), and
// regenerate ({ids:[id]}, force implied since ids bypasses the pending gate).
//
// Mirrors app/api/brief/route.ts's Make-webhook pattern: env-var URL + shared
// secret, one webhook call per document (the Make scenario handles exactly one
// doc per call — see lib/vault/limits.ts SUMMARY_BATCH_SIZE), tolerant-but-safe
// response parsing via parseSummaryResponse.

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { assembleSummaryPayload, parseSummaryResponse, nextSummaryStatus } from "@/lib/vault/summary"

export const runtime = "nodejs"
export const maxDuration = 60

const WEBHOOK_URL = process.env.MAKE_SUMMARY_WEBHOOK_URL
const WEBHOOK_SECRET = process.env.MAKE_SUMMARY_SECRET ?? ""
const MAX_IDS = 10
const DEFAULT_LIMIT = 5
const MAX_LIMIT = 20

interface ClaimedDoc {
  id: string
  title: string | null
  filename: string
  markdown_text: string | null
}

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

  let docs: ClaimedDoc[]

  if (body.ids?.length) {
    // Manual Summarize/Regenerate: bypasses the pending gate, scoped to the
    // caller's own in-vault docs via RLS. No SKIP LOCKED needed for a
    // deliberate, small, user-initiated click.
    const ids = body.ids.slice(0, MAX_IDS)
    const { data, error } = await supabase
      .from("conversions")
      .update({ summary_status: "running" })
      .in("id", ids)
      .eq("in_vault", true)
      .select("id, title, filename, markdown_text")
    if (error) {
      return NextResponse.json({ error: "DB_ERROR", message: "Couldn't claim documents." }, { status: 500 })
    }
    docs = (data ?? []) as ClaimedDoc[]
  } else {
    const limit = Math.min(Math.max(body.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
    const { data, error } = await supabase.rpc("claim_pending_summaries", { p_limit: limit })
    if (error) {
      return NextResponse.json({ error: "DB_ERROR", message: "Couldn't claim documents." }, { status: 500 })
    }
    docs = (data ?? []) as ClaimedDoc[]
  }

  let processed = 0
  let failed = 0
  const generatedAt = new Date().toISOString()
  const summaries: { id: string; summary: string }[] = []

  for (const doc of docs) {
    const { docs: payloadDocs } = assembleSummaryPayload([doc])
    const payload = payloadDocs[0]
    let ok = false

    try {
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mdspin-secret": WEBHOOK_SECRET },
        body: JSON.stringify({ maxWords: 40, docs: [payload] }),
      })
      if (res.ok) {
        const rawText = await res.text()
        const parsed = parseSummaryResponse(rawText, [doc.id])
        const summary = parsed[doc.id]
        if (summary) {
          await supabase
            .from("conversions")
            .update({ summary, summary_status: "ready", summary_generated_at: generatedAt })
            .eq("id", doc.id)
          summaries.push({ id: doc.id, summary })
          ok = true
        }
      }
    } catch {
      // Network error — fall through to the failure path below.
    }

    if (ok) {
      processed++
    } else {
      failed++
      // We don't know the doc's current summary_attempts here (the RPC/update above
      // didn't return it), so re-fetch just that column to decide pending vs failed.
      const { data: current } = await supabase
        .from("conversions")
        .select("summary_attempts")
        .eq("id", doc.id)
        .maybeSingle()
      const attempts = (current as { summary_attempts: number } | null)?.summary_attempts ?? 3
      await supabase
        .from("conversions")
        .update({ summary_status: nextSummaryStatus(attempts, false) })
        .eq("id", doc.id)
    }
  }

  const { count: remaining } = await supabase
    .from("conversions")
    .select("id", { count: "exact", head: true })
    .eq("in_vault", true)
    .eq("summary_status", "pending")

  return NextResponse.json({
    processed,
    failed,
    remaining: remaining ?? 0,
    summaries,
    summary_generated_at: generatedAt,
  })
}
