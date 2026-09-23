// GET-only status check for the filing-backfill banner: how many synced documents still
// need filing, and how many gave up. Mirrors app/api/vault/summaries/status/route.ts.
//
// 'flagged' is deliberately excluded from both counts: it's a completed decision (the
// classifier ran and chose not to act), not something the banner's drain loop should
// claim or retry -- it's surfaced instead via filing_note in the Unfiled view itself.

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_FAILED_IDS = 50

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "AUTH_REQUIRED", message: "Sign in first." }, { status: 401 })
  }

  const base = () =>
    supabase
      .from("conversions")
      .select("id", { count: "exact", head: true })
      .eq("in_vault", true)
      .eq("source_type", "sync")
      .is("project_id", null)

  const [pendingRes, failedRes] = await Promise.all([
    base().eq("filing_status", "pending"),
    supabase
      .from("conversions")
      .select("id")
      .eq("in_vault", true)
      .eq("source_type", "sync")
      .is("project_id", null)
      .eq("filing_status", "failed")
      .limit(MAX_FAILED_IDS),
  ])

  if (pendingRes.error || failedRes.error) {
    return NextResponse.json({ error: "DB_ERROR", message: "Couldn't check filing status." }, { status: 500 })
  }

  const failedIds = ((failedRes.data ?? []) as { id: string }[]).map((r) => r.id)

  return NextResponse.json({
    pending: pendingRes.count ?? 0,
    failed: failedIds.length,
    failedIds,
  })
}
