import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerCookieClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createVaultRepo } from "@/lib/vault/repo"
import { exchangeCodeForUserToken, listUserInstallationIds } from "@/lib/integrations/github/auth"
import { listInstallationRepos } from "@/lib/integrations/github/client"
import { startBackfill, runBackfillBatch } from "@/lib/integrations/github/sync"

export const runtime = "nodejs" // node:crypto (RS256 signing) — see lib/integrations/github/auth.ts

/**
 * GitHub App post-install redirect. This is the ONE place installation_id gets tied to
 * an MDSpin account, and it's the security-critical step: installation_id arrives as an
 * attacker-suppliable query parameter, and since installation tokens are minted from
 * the APP's own key (not the user's), trusting it blindly would let a signed-in MDSpin
 * user read a stranger's private repo into their own vault just by knowing or guessing
 * the id. `code` proves the CONNECTING user actually controls that installation —
 * exchanged once, used once (list their installations), then discarded. It is never
 * persisted.
 *
 * Stage 1 deliberately requires the installation to grant access to exactly one repo —
 * see docs/superpowers/plans (Live Source Sync) for why a full repo-picker step was cut
 * from this stage. Installing with "All repositories" or multiple repos selected is
 * rejected with a message telling the user to reinstall scoped to one repo.
 */
function redirectToIntegrations(req: NextRequest, params: Record<string, string>): NextResponse {
  const url = new URL("/app/integrations", req.nextUrl.origin)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return NextResponse.redirect(url)
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")
  const installationId = req.nextUrl.searchParams.get("installation_id")
  const setupAction = req.nextUrl.searchParams.get("setup_action")

  if (setupAction === "request") {
    // The installing account isn't an org owner and requested approval from one — there
    // is nothing to connect yet.
    return redirectToIntegrations(req, { error: "installation_pending_approval" })
  }
  if (!code || !installationId) {
    return redirectToIntegrations(req, { error: "missing_params" })
  }

  const cookieClient = await createServerCookieClient()
  const {
    data: { user },
  } = await cookieClient.auth.getUser()
  if (!user) {
    return redirectToIntegrations(req, { error: "sign_in_required" })
  }

  let userToken: string
  try {
    userToken = await exchangeCodeForUserToken(code)
  } catch {
    return redirectToIntegrations(req, { error: "github_exchange_failed" })
  }

  let ownedInstallations: Set<string>
  try {
    ownedInstallations = await listUserInstallationIds(userToken)
  } catch {
    return redirectToIntegrations(req, { error: "github_verify_failed" })
  }
  // userToken is discarded from here on — it was only ever needed for the ownership
  // check above, never persisted, never used to read repo content.
  if (!ownedInstallations.has(installationId)) {
    return redirectToIntegrations(req, { error: "not_your_installation" })
  }

  const admin = createAdminClient()
  if (!admin) {
    return redirectToIntegrations(req, { error: "not_configured" })
  }

  let repos
  try {
    repos = await listInstallationRepos(installationId)
  } catch {
    return redirectToIntegrations(req, { error: "github_list_repos_failed" })
  }
  if (repos.length === 0) {
    return redirectToIntegrations(req, { error: "no_repos_selected" })
  }
  if (repos.length > 1) {
    // Carry enough back for the page to render an actionable fix, not just a banner:
    // the count (so the message states the actual problem instead of a generic
    // "select one repo"), and the installation_id (non-secret, GitHub-controlled — see
    // lib/integrations/github/auth.ts's header comment) so it can deep-link straight to
    // GitHub's own "which repos" screen for THIS installation, which is otherwise a page
    // most people have never seen and wouldn't know to look for.
    return redirectToIntegrations(req, {
      error: "select_one_repo",
      repo_count: String(repos.length),
      installation_id: installationId,
    })
  }
  const repo = repos[0]

  const vaultRepo = createVaultRepo(admin, { enforce: "explicit", userId: user.id })

  let connection
  try {
    connection = await vaultRepo.createSourceConnection({
      provider: "github",
      displayName: `${repo.fullName} (${repo.defaultBranch})`,
      config: { owner: repo.owner, repo: repo.name, repo_id: repo.id, branch: repo.defaultBranch, path_prefix: null },
      externalAccountId: installationId,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : ""
    if (message.includes("already connected")) {
      return redirectToIntegrations(req, { error: "already_connected" })
    }
    return redirectToIntegrations(req, { error: "create_connection_failed" })
  }

  // Kick off the first backfill batch synchronously — small repos finish in one shot,
  // and the connection card shows "Continue backfill" if there's more. This keeps the
  // redirect target immediately useful instead of landing on an empty "syncing…" card
  // with no feedback for a repo that would've finished in under a second anyway.
  try {
    const cfg = { owner: repo.owner, repo: repo.name, branch: repo.defaultBranch, pathPrefix: null }
    const { cursor, refusedReason } = await startBackfill(installationId, cfg)
    if (refusedReason) {
      await vaultRepo.updateSourceConnection(connection.id, { status: "error", lastError: refusedReason })
    } else if (cursor.paths.length === 0) {
      await vaultRepo.updateSourceConnection(connection.id, { lastSyncedAt: new Date().toISOString() })
    } else {
      const { nextCursor } = await runBackfillBatch(vaultRepo, connection.id, installationId, cfg, cursor)
      await vaultRepo.updateSourceConnection(connection.id, {
        config: { ...connection.config, backfill_cursor: nextCursor },
        lastSyncedAt: nextCursor ? null : new Date().toISOString(),
      })
    }
  } catch (err) {
    await vaultRepo.updateSourceConnection(connection.id, {
      status: "error",
      lastError: err instanceof Error ? err.message : "Backfill failed to start.",
    })
  }

  return redirectToIntegrations(req, { connected: connection.id })
}
