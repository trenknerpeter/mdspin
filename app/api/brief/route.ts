// Server proxy: assembles a doc's related cluster, sends it to a Make webhook for
// LLM synthesis, stores the returned brief on the source row. The webhook URL and
// secret never reach the browser.

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { assembleClusterPayload, CLUSTER_DOC_CAP, type ClusterDoc } from "@/lib/brief"

export const runtime = "nodejs"
export const maxDuration = 60 // LLM synthesis latency

const WEBHOOK_URL = process.env.MAKE_BRIEF_WEBHOOK_URL
const WEBHOOK_SECRET = process.env.MAKE_BRIEF_SECRET ?? ""
const MAX_RELATED = 5

export async function POST(req: NextRequest) {
  if (!WEBHOOK_URL) {
    return NextResponse.json(
      { error: "NOT_CONFIGURED", message: "Brief synthesis is not configured." },
      { status: 503 }
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "AUTH_REQUIRED", message: "Sign in first." }, { status: 401 })
  }

  let body: { sourceId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "INVALID_REQUEST", message: "Body must be JSON." }, { status: 400 })
  }
  const sourceId = body.sourceId?.trim()
  if (!sourceId) {
    return NextResponse.json({ error: "MISSING_SOURCE", message: "sourceId is required." }, { status: 400 })
  }

  // Source row (RLS scopes to the caller)
  const { data: source, error: srcErr } = await supabase
    .from("conversions")
    .select("id, title, filename, markdown_text")
    .eq("id", sourceId)
    .maybeSingle()
  if (srcErr) {
    return NextResponse.json({ error: "DB_ERROR", message: srcErr.message }, { status: 500 })
  }
  if (!source) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Doc not found." }, { status: 404 })
  }

  // Related ids via the relatedness RPC
  const { data: relatedRows, error: relErr } = await supabase.rpc("find_related_conversions", {
    source_id: sourceId,
    max_results: MAX_RELATED,
  })
  if (relErr) {
    return NextResponse.json({ error: "DB_ERROR", message: relErr.message }, { status: 500 })
  }
  const relatedIds = ((relatedRows ?? []) as { id: string }[]).map((r) => r.id)
  if (relatedIds.length === 0) {
    return NextResponse.json(
      { error: "NO_RELATED", message: "No related docs to synthesize across yet." },
      { status: 422 }
    )
  }

  // Related docs' content
  const { data: relatedDocs, error: contentErr } = await supabase
    .from("conversions")
    .select("id, title, filename, markdown_text")
    .in("id", relatedIds)
  if (contentErr) {
    return NextResponse.json({ error: "DB_ERROR", message: contentErr.message }, { status: 500 })
  }

  const payload = assembleClusterPayload(
    source as ClusterDoc,
    (relatedDocs ?? []) as ClusterDoc[],
    CLUSTER_DOC_CAP
  )

  // Call Make
  let makeRes: Response
  try {
    makeRes = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-mdspin-secret": WEBHOOK_SECRET },
      body: JSON.stringify(payload),
    })
  } catch {
    return NextResponse.json(
      { error: "MAKE_UNREACHABLE", message: "Couldn't reach the synthesis service. Try again." },
      { status: 502 }
    )
  }
  if (!makeRes.ok) {
    return NextResponse.json(
      { error: "MAKE_ERROR", message: "Synthesis failed. Try again." },
      { status: 502 }
    )
  }
  let brief = ""
  try {
    const json = await makeRes.json()
    brief = typeof json.brief === "string" ? json.brief : ""
  } catch {
    brief = ""
  }
  if (!brief.trim()) {
    return NextResponse.json(
      { error: "MAKE_EMPTY", message: "Synthesis returned nothing. Try again." },
      { status: 502 }
    )
  }

  // Persist on the source row
  const generatedAt = new Date().toISOString()
  const { error: updErr } = await supabase
    .from("conversions")
    .update({ brief, brief_generated_at: generatedAt })
    .eq("id", sourceId)
  if (updErr) {
    // Generation worked; persistence didn't — still return the brief so it isn't lost.
    return NextResponse.json({ brief, brief_generated_at: generatedAt, saved: false })
  }

  return NextResponse.json({ brief, brief_generated_at: generatedAt, saved: true })
}
