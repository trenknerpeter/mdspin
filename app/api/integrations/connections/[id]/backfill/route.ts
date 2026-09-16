import { NextRequest, NextResponse } from "next/server"
import { getVaultForRequest } from "@/lib/vault/server"
import { vaultErrorResponse } from "@/lib/vault/http"
import { VaultError } from "@/lib/vault/errors"
import { isValidUuid } from "@/lib/vault/query"
import { runBackfillBatch, type BackfillCursor, type SyncConfig } from "@/lib/integrations/github/sync"

export const runtime = "nodejs"
export const maxDuration = 60

interface ConnectionConfig {
  owner: string
  repo: string
  branch: string
  path_prefix: string | null
  backfill_cursor?: BackfillCursor | null
}

/** Continue a paused-mid-backfill connection. The client (the integrations page) calls
 *  this repeatedly — once per click of "Continue backfill" — rather than the server
 *  looping internally, so a large repo's backfill progress is visible rather than one
 *  long request racing Vercel's 60s ceiling. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { repo } = await getVaultForRequest(req)
    const { id } = await params
    if (!isValidUuid(id)) throw new VaultError("INVALID_REQUEST", "id must be a valid UUID.")

    const connection = await repo.getSourceConnection(id)
    if (!connection) throw new VaultError("NOT_FOUND", "Connection not found.")
    const config = connection.config as unknown as ConnectionConfig
    const cursor = config.backfill_cursor
    if (!cursor) {
      return NextResponse.json({ done: true, processed: 0 })
    }

    const cfg: SyncConfig = { owner: config.owner, repo: config.repo, branch: config.branch, pathPrefix: config.path_prefix }
    const { result, nextCursor } = await runBackfillBatch(repo, id, connection.externalAccountId, cfg, cursor)

    await repo.updateSourceConnection(id, {
      config: { ...config, backfill_cursor: nextCursor },
      lastSyncedAt: nextCursor ? connection.lastSyncedAt : new Date().toISOString(),
    })

    return NextResponse.json({
      done: !nextCursor,
      processed: result.outcomes.length,
      remaining: nextCursor ? cursor.paths.length - nextCursor.nextIndex : 0,
      errors: result.outcomes.filter((o) => o.error).map((o) => ({ path: o.path, error: o.error })),
    })
  } catch (err) {
    return vaultErrorResponse(err)
  }
}
