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
import type { ServerContext } from "@modelcontextprotocol/server"

export interface McpAuthContext {
  http?: {
    authInfo?: {
      clientId?: string
      extra?: Record<string, unknown>
    }
  }
}

// Compile-time guards tying McpAuthContext to the SDK's real ServerContext. Without them,
// an SDK rename of http/authInfo/clientId would leave tsc silent and instead make all 7
// tools + 1 prompt fail identically at RUNTIME ("resolveUserId called without a validated
// authInfo") the next time someone connects. Neither line has any runtime purpose; the
// `void` statements just keep them from reading as unused locals.
//
// Guard 1 catches a rename of `http` or `authInfo` — TS's weak-type rule fires because the
// renamed shape would have no properties in common with an all-optional target.
const _serverContextShapeGuard: McpAuthContext["http"] = ({} as ServerContext).http
// Guard 2 is needed on top of it: a rename of `clientId` alone would NOT trip guard 1
// (`extra` still overlaps, and an optional `clientId` may simply be absent), so read the
// exact field resolveUserId depends on directly.
const _clientIdShapeGuard: string | undefined = ({} as ServerContext).http?.authInfo?.clientId
void _serverContextShapeGuard
void _clientIdShapeGuard

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
