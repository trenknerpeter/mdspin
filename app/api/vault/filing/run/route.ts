// Filing drainer for the GitHub auto-filing pipeline. One caller: the vault-wide backfill
// banner ({limit} for "Classify now", {ids} for "Retry failed"). Unlike summaries, there is
// no per-request GitHub push caller here -- the webhook's own inline drain
// (app/api/webhooks/github/route.ts) calls classifyAndStoreDocument directly rather than
// going through this route, since it already holds the touched ids and doesn't need the
// claim-by-limit path.
//
// The actual classifying lives in lib/vault/classify-document.ts, shared with the webhook's
// inline drain so the two can't drift.

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { classifyAndStoreDocument, type ClassifiableDoc } from "@/lib/vault/classify-document"
import type { FilingCandidateProject } from "@/lib/vault/filing"

export const runtime = "nodejs"
export const maxDuration = 60

const WEBHOOK_URL = process.env.MAKE_FILING_WEBHOOK_URL
const WEBHOOK_SECRET = process.env.MAKE_FILING_SECRET ?? ""
const MAX_IDS = 10
const DEFAULT_LIMIT = 5
const MAX_LIMIT = 20

interface ClaimedRow {
  id: string
  user_id?: string
  title: string | null
  filename: string
  markdown_text: string | null
  external_id: string | null
  source_connection_id: string | null
}

export async function POST(req: NextRequest) {
  if (!WEBHOOK_URL) {
    return NextResponse.json(
      { error: "NOT_CONFIGURED", message: "Document filing is not configured." },
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

  let rows: ClaimedRow[]
  if (body.ids?.length) {
    const { data, error } = await supabase.rpc("claim_filings_by_id", { p_ids: body.ids.slice(0, MAX_IDS) })
    if (error) {
      return NextResponse.json({ error: "DB_ERROR", message: "Couldn't claim documents." }, { status: 500 })
    }
    rows = (data ?? []) as ClaimedRow[]
  } else {
    const limit = Math.min(Math.max(body.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
    const { data, error } = await supabase.rpc("claim_pending_filings", { p_limit: limit })
    if (error) {
      return NextResponse.json({ error: "DB_ERROR", message: "Couldn't claim documents." }, { status: 500 })
    }
    rows = (data ?? []) as ClaimedRow[]
  }

  const results: Awaited<ReturnType<typeof classifyAndStoreDocument>>[] = []

  if (rows.length > 0) {
    // Only top-level projects are filing candidates -- subproject placement stays manual.
    const { data: projectRows } = await supabase.from("projects").select("id, name").is("parent_id", null)
    const candidates: FilingCandidateProject[] = (projectRows ?? []) as FilingCandidateProject[]

    const connectionIds = [...new Set(rows.map((r) => r.source_connection_id).filter((id): id is string => !!id))]
    const repoByConnectionId = new Map<string, string>()
    if (connectionIds.length > 0) {
      const { data: connections } = await supabase
        .from("source_connections")
        .select("id, config")
        .in("id", connectionIds)
      for (const c of (connections ?? []) as { id: string; config: { repo?: string } }[]) {
        if (c.config?.repo) repoByConnectionId.set(c.id, c.config.repo)
      }
    }

    const deps = { webhookUrl: WEBHOOK_URL, webhookSecret: WEBHOOK_SECRET }
    for (const row of rows) {
      const doc: ClassifiableDoc = {
        id: row.id,
        user_id: row.user_id ?? user.id,
        title: row.title,
        filename: row.filename,
        markdown_text: row.markdown_text,
        external_id: row.external_id,
        source_connection_id: row.source_connection_id,
      }
      const repoName = row.source_connection_id ? repoByConnectionId.get(row.source_connection_id) ?? null : null
      results.push(await classifyAndStoreDocument(supabase, doc, candidates, { ...deps, repoName }))
    }
  }

  const { count: remaining } = await supabase
    .from("conversions")
    .select("id", { count: "exact", head: true })
    .eq("in_vault", true)
    .eq("source_type", "sync")
    .is("project_id", null)
    .eq("filing_status", "pending")

  const processed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length

  return NextResponse.json({
    processed,
    failed,
    remaining: remaining ?? 0,
    results: results.map(({ id, label, ok, outcome, reason }) => ({ id, label, ok, outcome, reason })),
  })
}
