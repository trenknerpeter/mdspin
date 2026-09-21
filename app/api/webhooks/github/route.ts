import { NextRequest, NextResponse } from "next/server"
import { after } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createVaultRepo } from "@/lib/vault/repo"
import { verifyWebhookSignature } from "@/lib/integrations/github/webhook-signature"
import { runIncrementalSync, type SyncConfig } from "@/lib/integrations/github/sync"
import type { GitHubPushPayload } from "@/lib/integrations/github/changes"
import { embedAndStoreDocument, type EmbeddableDoc } from "@/lib/vault/embed-document"
import { trackServer } from "@/lib/posthog-server"
import { EVENTS } from "@/lib/analytics/events"

export const runtime = "nodejs" // node:crypto (HMAC verification) — see lib/integrations/github/auth.ts
export const maxDuration = 60

interface SourceConnectionAdminRow {
  id: string
  user_id: string
  status: string
  config: { owner: string; repo: string; repo_id: number; branch: string; path_prefix: string | null }
}

async function findConnection(installationId: string, repositoryId: number): Promise<SourceConnectionAdminRow | null> {
  const admin = createAdminClient()
  if (!admin) return null
  // (provider, external_account_id) is unique, so at most one row — but the installation
  // may have been reconfigured to a different single repo since we connected; the
  // repo_id check below is what makes that a no-op instead of syncing the wrong repo.
  const { data } = await admin
    .from("source_connections")
    .select("id, user_id, status, config")
    .eq("provider", "github")
    .eq("external_account_id", installationId)
    .maybeSingle()
  if (!data) return null
  const row = data as SourceConnectionAdminRow
  if (row.config?.repo_id !== repositoryId) return null
  return row
}

/**
 * Returns a 202 in well under GitHub's 10-second webhook delivery timeout, then does
 * every actual API call and DB write in `after()`. This is load-bearing, not an
 * optimization: a slow handler here shows up as failed deliveries in GitHub's own
 * Advanced -> Deliveries UI, GitHub Apps don't auto-retry those, and a sustained
 * failure rate is grounds for GitHub disabling the hook outright.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get("x-hub-signature-256")
  if (!verifyWebhookSignature(rawBody, signature, process.env.GITHUB_APP_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 })
  }

  const event = req.headers.get("x-github-event")
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  after(async () => {
    try {
      await handleEvent(event, payload)
    } catch (err) {
      console.error("[webhooks/github] handler failed:", err)
      trackServer(EVENTS.githubSyncFailed, {
        properties: { trigger: "push", event, error: err instanceof Error ? err.message : "unknown" },
      })
    }
  })

  return NextResponse.json({ ok: true }, { status: 202 })
}

async function handleEvent(event: string | null, payload: Record<string, unknown>): Promise<void> {
  if (event === "push") return handlePush(payload as unknown as GitHubPushPayload & { repository: { id: number } })
  if (event === "installation") return handleInstallation(payload)
  if (event === "installation_repositories") return handleInstallationRepositories(payload)
  if (event === "repository") return handleRepositoryRenamed(payload)
  // Every other event this app doesn't subscribe to meaningfully — ignored, not an error.
}

async function handlePush(payload: GitHubPushPayload & { repository: { id: number }; installation?: { id: number } }): Promise<void> {
  const installationId = payload.installation?.id
  if (!installationId) return
  const connection = await findConnection(String(installationId), payload.repository.id)
  if (!connection || connection.status !== "active") return

  const admin = createAdminClient()
  if (!admin) return
  const repo = createVaultRepo(admin, { enforce: "explicit", userId: connection.user_id })
  const cfg: SyncConfig = {
    owner: connection.config.owner,
    repo: connection.config.repo,
    branch: connection.config.branch,
    pathPrefix: connection.config.path_prefix,
  }

  if (payload.deleted) {
    // Branch deletion isn't a "resync"; there's nothing left to sync FROM. Surface it as
    // an error state rather than silently doing nothing forever.
    await repo.updateSourceConnection(connection.id, {
      status: "error",
      lastError: `Branch "${cfg.branch}" was deleted at the source.`,
    })
    return
  }

  const existingExternalIds = await repo.listExternalIdsForConnection(connection.id)
  const { resolution, result, goneIds } = await runIncrementalSync(
    repo,
    connection.id,
    String(installationId),
    cfg,
    payload,
    existingExternalIds
  )

  if (resolution.kind === "ignored_branch") return

  trackServer(EVENTS.githubSyncRan, {
    distinctId: connection.user_id,
    properties: {
      trigger: "push",
      touched: result?.touchedIds.length ?? 0,
      gone: goneIds.length,
      resolution: resolution.kind,
    },
  })

  if (goneIds.length > 0) await repo.markDocumentsMissing(connection.id, goneIds)

  // Inline-drain summaries/embeddings for just the touched docs — a typical push is a
  // handful of files and finishes in seconds. Anything beyond a normal push's size
  // falls through to the daily cron, same as any other pending document.
  // Inline-drain summaries for just the touched docs via the service-role-safe claim
  // (see claim_summaries_by_id_for_user's own comment for why the plain
  // claim_summaries_by_id would silently claim zero rows here). A typical push is a
  // handful of files and finishes in seconds; anything larger falls through to the
  // daily cron like any other pending document.
  const webhookUrl = process.env.MAKE_SUMMARY_WEBHOOK_URL
  if (result && result.touchedIds.length > 0 && webhookUrl) {
    const { summarizeAndStoreDocument } = await import("@/lib/vault/summarize-document")
    const { data: claimed } = await admin.rpc("claim_summaries_by_id_for_user", {
      p_user_id: connection.user_id,
      p_ids: result.touchedIds,
    })
    for (const doc of (claimed ?? []) as Array<{ id: string; title: string | null; filename: string; markdown_text: string | null }>) {
      await summarizeAndStoreDocument(admin, doc, {
        webhookUrl,
        webhookSecret: process.env.MAKE_SUMMARY_SECRET ?? "",
      })
    }
  }

  // Embeddings mirror the manual {ids} drain path (app/api/vault/embeddings/run) — a
  // plain claim via .update() is safe here (no attempts race to guard against, unlike
  // summaries), scoped to ids this webhook itself just resolved via a user-scoped repo
  // call, never an externally-suppliable list.
  if (result && result.touchedIds.length > 0) {
    const { data: embedClaimed } = await admin
      .from("conversions")
      .update({ embedding_status: "running", embedding_claimed_at: new Date().toISOString() })
      .in("id", result.touchedIds)
      .eq("in_vault", true)
      .select("id, user_id, title, filename, markdown_text")
    for (const doc of (embedClaimed ?? []) as EmbeddableDoc[]) {
      await embedAndStoreDocument(admin, doc)
    }
  }

  await repo.updateSourceConnection(connection.id, {
    lastSyncedAt: new Date().toISOString(),
    lastSyncedSha: payload.after,
    status: "active",
    lastError: null,
  })
}

async function handleInstallation(payload: Record<string, unknown>): Promise<void> {
  const action = payload.action
  const installation = payload.installation as { id: number } | undefined
  if (action !== "deleted" || !installation) return

  const admin = createAdminClient()
  if (!admin) return
  await admin
    .from("source_connections")
    .update({ status: "revoked", last_error: "The GitHub App installation was removed." })
    .eq("provider", "github")
    .eq("external_account_id", String(installation.id))
}

async function handleInstallationRepositories(payload: Record<string, unknown>): Promise<void> {
  const action = payload.action
  if (action !== "removed") return
  const installation = payload.installation as { id: number } | undefined
  const removed = payload.repositories_removed as Array<{ id: number }> | undefined
  if (!installation || !removed?.length) return

  const admin = createAdminClient()
  if (!admin) return
  const { data } = await admin
    .from("source_connections")
    .select("id, config")
    .eq("provider", "github")
    .eq("external_account_id", String(installation.id))
    .maybeSingle()
  const row = data as { id: string; config: { repo_id: number } } | null
  if (row && removed.some((r) => r.id === row.config.repo_id)) {
    await admin
      .from("source_connections")
      .update({ status: "revoked", last_error: "This repository was removed from the GitHub App installation." })
      .eq("id", row.id)
  }
}

async function handleRepositoryRenamed(payload: Record<string, unknown>): Promise<void> {
  if (payload.action !== "renamed") return
  const repository = payload.repository as { id: number; name: string; owner: { login: string } } | undefined
  const installation = payload.installation as { id: number } | undefined
  if (!repository || !installation) return

  const admin = createAdminClient()
  if (!admin) return
  const { data } = await admin
    .from("source_connections")
    .select("id, config")
    .eq("provider", "github")
    .eq("external_account_id", String(installation.id))
    .maybeSingle()
  const row = data as { id: string; config: Record<string, unknown> } | null
  if (row && row.config.repo_id === repository.id) {
    await admin
      .from("source_connections")
      .update({ config: { ...row.config, owner: repository.owner.login, repo: repository.name } })
      .eq("id", row.id)
  }
}
