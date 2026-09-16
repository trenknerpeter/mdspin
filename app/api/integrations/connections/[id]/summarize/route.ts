import { NextRequest, NextResponse } from "next/server"
import { getVaultForRequest } from "@/lib/vault/server"
import { vaultErrorResponse } from "@/lib/vault/http"
import { VaultError } from "@/lib/vault/errors"
import { isValidUuid } from "@/lib/vault/query"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Enqueue every backfilled ('manual'-status) document under this connection for
 * summarization — the accelerator button next to a connection card. Backfill itself
 * deliberately leaves summary_status='manual' rather than 'pending' (see the Stage 1
 * throughput decision: the daily drain does 3 docs/day, so enqueueing an entire fresh
 * backfill would take months and would starve every other pending document in the
 * process — see claim_pending_summaries_global's FIFO ordering fix). This just flips
 * the status; the existing drain (daily cron, or the next push's inline drain) does the
 * actual work from here, same as any other pending document.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { repo } = await getVaultForRequest(req)
    const { id } = await params
    if (!isValidUuid(id)) throw new VaultError("INVALID_REQUEST", "id must be a valid UUID.")

    const connection = await repo.getSourceConnection(id)
    if (!connection) throw new VaultError("NOT_FOUND", "Connection not found.")

    const enqueued = await repo.enqueueManualSummaries(id)
    return NextResponse.json({ enqueued })
  } catch (err) {
    return vaultErrorResponse(err)
  }
}
