// GET-only status check for the embedding-backfill banner: how many in-vault documents
// still need chunking/embedding. Deliberately a tiny purpose-built route rather than a
// lib/vault/repo.ts method — this is backfill-progress bookkeeping, not a document-facing
// field any REST/MCP consumer needs (contrast with summary_status, which IS user-facing
// and lives on VaultDocument).

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "AUTH_REQUIRED", message: "Sign in first." }, { status: 401 })
  }

  // `failed` alongside `pending`: without it the banner disappears the moment `pending`
  // hits 0, reporting success even when documents ended up 'failed' with zero chunks.
  const [{ count: pending, error: pendingError }, { count: failed, error: failedError }] = await Promise.all([
    supabase
      .from("conversions")
      .select("id", { count: "exact", head: true })
      .eq("in_vault", true)
      .eq("embedding_status", "pending"),
    supabase
      .from("conversions")
      .select("id", { count: "exact", head: true })
      .eq("in_vault", true)
      .eq("embedding_status", "failed"),
  ])

  if (pendingError || failedError) {
    return NextResponse.json({ error: "DB_ERROR", message: "Couldn't check embedding status." }, { status: 500 })
  }

  return NextResponse.json({ pending: pending ?? 0, failed: failed ?? 0 })
}
