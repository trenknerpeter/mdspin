// Turns a tool/prompt handler's ctx into a VaultRepo. resolveUserId is the ONE place a
// handler's userId comes from; repoForContext is the ONE place the service-role admin
// client is constructed for the MCP surface. Every tool/prompt handler calls
// repoForContext(ctx) — never resolveUserId or createAdminClient directly.
//
// Deliberately NOT marked "server-only": lib/vault/repo.ts itself isn't either (Stage 2a
// kept it client-importable for the browser path), and this file is only ever reached
// through app/api/mcp/route.ts's server-only import graph anyway. Staying unmarked is
// also what lets resolveUserId be unit-tested directly under plain `vitest run` — see
// lib/vault/http.ts (Stage 2d) for why "server-only" specifically breaks that.

import { createAdminClient } from "@/lib/supabase/admin"
import { createVaultRepo } from "@/lib/vault/repo"
import { VaultError } from "@/lib/vault/errors"
import type { VaultRepo } from "@/lib/vault/repo"

export interface McpAuthContext {
  http?: {
    authInfo?: {
      clientId?: string
      extra?: Record<string, unknown>
    }
  }
}

export function resolveUserId(ctx: McpAuthContext): string {
  const userId = ctx.http?.authInfo?.clientId
  if (!userId) {
    throw new Error("resolveUserId called without a validated authInfo — withMcpAuth misconfigured?")
  }
  return userId
}

export function repoForContext(ctx: McpAuthContext): VaultRepo {
  const userId = resolveUserId(ctx)
  const admin = createAdminClient()
  if (!admin) {
    throw new VaultError("NOT_CONFIGURED", "Vault MCP is not configured on this server.")
  }
  return createVaultRepo(admin, { enforce: "explicit", userId })
}
