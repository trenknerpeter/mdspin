// Vercel Cron target that enforces guest-usage retention: deletes IP-keyed free-preview
// counters 90 days after a guest's last conversion. This is what makes the privacy page's
// retention promise true — without it anon_usage is a lifetime counter that grows forever.
// The deletion logic lives in the prune_guest_usage SQL function (see its migration).
//
// Protected by CRON_SECRET, exactly like app/api/cron/embeddings: 503 when the secret
// isn't configured at all, 401 when it's wrong.

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

// Keep in sync with the retention period stated on app/privacy/page.tsx.
const GUEST_RETENTION_DAYS = 90

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

  const { data, error } = await supabase.rpc("prune_guest_usage", { p_days: GUEST_RETENTION_DAYS })
  if (error) {
    console.error("[cron/prune-guest-usage] prune failed:", error.message)
    return NextResponse.json({ error: "DB_ERROR", message: "Couldn't prune guest usage." }, { status: 500 })
  }
  return NextResponse.json({ deleted: data })
}
