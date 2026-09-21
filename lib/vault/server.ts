import "server-only"

// The server-side entry point a future REST route (Stage 2d) or MCP tool (Stage 2e)
// calls: one function, request in, scoped repo out. Keeping this glue in its own file
// (rather than folding it into auth.ts) is what lets auth.ts stay a pure resolver with no
// knowledge of the repo, and repo.ts stay ignorant of HTTP entirely.

import { authenticateRequest, type AuthenticatableRequest } from "./auth"
import { createVaultRepo, type VaultRepo } from "./repo"
import type { VaultScope } from "./types"
import { trackServer } from "@/lib/posthog-server"
import { EVENTS } from "@/lib/analytics/events"

export interface RequestVault {
  repo: VaultRepo
  scope: VaultScope
  /** See AuthResult.keyId in auth.ts — passed through unchanged. */
  keyId?: string
}

/** Throws a VaultError (AUTH_REQUIRED / NOT_CONFIGURED / DB_ERROR) if the request can't
 *  be authenticated — callers should let it propagate to a catch that maps
 *  `err.toResponse()` / `err.status` onto the HTTP response, matching the existing
 *  app/api/brief/route.ts convention. */
export async function getVaultForRequest(req: AuthenticatableRequest): Promise<RequestVault> {
  const { scope, client, keyId } = await authenticateRequest(req)

  // Every v1 REST route funnels through here, so this is the one place that can
  // answer "is the public API actually used, or just generated and forgotten?".
  // Only the route shape is recorded — never ids, query strings or bodies.
  const method = req.method ?? "GET"
  const isWrite = method !== "GET" && method !== "HEAD"
  trackServer(isWrite ? EVENTS.vaultApiWrite : EVENTS.vaultApiRead, {
    distinctId: scope.userId,
    properties: {
      method,
      route: routeShape(req.url),
      auth: keyId ? "api_key" : "session",
    },
  })

  return { repo: createVaultRepo(client, scope), scope, keyId }
}

/** "/api/v1/vault/documents/<uuid>/related" -> "/api/v1/vault/documents/:id/related".
 *  Collapses ids so the property stays low-cardinality and carries no user data. */
function routeShape(url: string | undefined): string {
  if (!url) return "unknown"
  try {
    return new URL(url).pathname.replace(
      /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      "/:id"
    )
  } catch {
    return "unknown"
  }
}
