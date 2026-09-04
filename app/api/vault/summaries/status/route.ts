// GET-only status check for the summary-backfill banner: how many in-vault documents still
// need a summary, how many gave up, and how many were never enqueued at all.
//
// `missing` is the canary. It counts in-vault rows with summary_status IS NULL — rows the
// claim RPCs can never see, because they match only 'pending'. That is exactly the bug that
// hid this pipeline's total failure for a month: 24 of 60 documents sat at NULL while
// lib/vault/mappers.ts's `?? "pending"` displayed them as pending over MCP/REST. After
// 20260904000000 it should be permanently 0, and if it ever isn't, a fifth write path has
// forgotten the column and this surfaces it on the vault page instead of in a month.

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Enough to drive a bulk retry (the run route takes 10 ids per call) without returning an
// unbounded id list for a large vault.
const MAX_FAILED_IDS = 50

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "AUTH_REQUIRED", message: "Sign in first." }, { status: 401 })
  }

  const base = () => supabase.from("conversions").select("id", { count: "exact", head: true }).eq("in_vault", true)

  const [pendingRes, missingRes, failedRes] = await Promise.all([
    base().eq("summary_status", "pending"),
    base().is("summary_status", null),
    supabase
      .from("conversions")
      .select("id")
      .eq("in_vault", true)
      .eq("summary_status", "failed")
      .limit(MAX_FAILED_IDS),
  ])

  if (pendingRes.error || missingRes.error || failedRes.error) {
    return NextResponse.json({ error: "DB_ERROR", message: "Couldn't check summary status." }, { status: 500 })
  }

  const failedIds = ((failedRes.data ?? []) as { id: string }[]).map((r) => r.id)

  return NextResponse.json({
    pending: pendingRes.count ?? 0,
    missing: missingRes.count ?? 0,
    failed: failedIds.length,
    failedIds,
  })
}
