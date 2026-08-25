import "server-only"

// The server-side entry point a future REST route (Stage 2d) or MCP tool (Stage 2e)
// calls: one function, request in, scoped repo out. Keeping this glue in its own file
// (rather than folding it into auth.ts) is what lets auth.ts stay a pure resolver with no
// knowledge of the repo, and repo.ts stay ignorant of HTTP entirely.

import { authenticateRequest, type AuthenticatableRequest } from "./auth"
import { createVaultRepo, type VaultRepo } from "./repo"
import type { VaultScope } from "./types"

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
  return { repo: createVaultRepo(client, scope), scope, keyId }
}
