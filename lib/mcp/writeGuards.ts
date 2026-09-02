// Stage 4 usage metering + quota gate. Applied at tool-registration time in
// lib/mcp/server.ts — every read tool goes through withReadUsageTracking, every write
// tool goes through withWriteQuota. See lib/vault/mcp-usage.ts for the fail-open (reads)
// vs fail-closed (writes) asymmetry this wraps around.

import { createAdminClient } from "@/lib/supabase/admin"
import { incrementMcpRead, tryIncrementMcpWrite } from "@/lib/vault/mcp-usage"
import { VaultError } from "@/lib/vault/errors"
import { toolError } from "./errors"
import { resolveKeyId, type McpAuthContext } from "./context"

const DEFAULT_WRITE_DAILY_LIMIT = 200

function writeDailyLimit(): number {
  const raw = Number(process.env.MCP_WRITE_DAILY_LIMIT)
  return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : DEFAULT_WRITE_DAILY_LIMIT
}

// The index signature is required, not decorative: the SDK's own CallToolResult shape
// (what registerTool's overloads actually expect a handler to return) carries one, and a
// hand-declared interface without one is NOT treated as satisfying it structurally — every
// registerTool call below would fail to type-check without this.
interface McpToolResult {
  [key: string]: unknown
  content: Array<{ type: "text"; text: string }>
  isError?: boolean
}

// C is generic (not `unknown`) so a wrapped tool's config keeps the concrete shape
// McpServer.registerTool's overloads expect (e.g. a Zod inputSchema) instead of widening
// to `unknown` and failing every registerTool call in server.ts at compile time.
interface McpTool<A, C = unknown> {
  name: string
  config: C
  handler: (args: A, ctx: McpAuthContext) => Promise<McpToolResult>
}

/** Wrap a READ tool so every successful (non-isError) call is metered into
 *  mcp_usage.read_count. weightOf lets a caller (e.g. get_document's content:"full" case)
 *  charge more than 1 — everything else defaults to 1. Fail-open: no resolvable key id, no
 *  admin client, or a metering error are all swallowed — see incrementMcpRead.
 *
 *  Dispatches on the REAL number of arguments the SDK calls the handler with, rather than
 *  assuming arity 2 (args, ctx). Two of the seven read tools (vault_overview,
 *  list_projects) take no input and so have no `inputSchema` in their config;
 *  @modelcontextprotocol/server's own tool executor (createToolExecutor) detects that at
 *  registration time and invokes the handler with ONE argument (ctx only). A handler
 *  hard-coded as (args, ctx) => ... would silently receive ctx in the `args` slot and
 *  `undefined` in `ctx`, and resolveKeyId(undefined) would throw on every such call. */
export function withReadUsageTracking<A, C>(
  tool: McpTool<A, C>,
  weightOf: (args: A) => number = () => 1
): McpTool<A, C> {
  const handler = (async (...callArgs: unknown[]) => {
    const hasArgs = callArgs.length > 1
    const ctx = (hasArgs ? callArgs[1] : callArgs[0]) as McpAuthContext
    const args = (hasArgs ? callArgs[0] : undefined) as A
    const result = await (tool.handler as unknown as (...a: unknown[]) => Promise<McpToolResult>)(...callArgs)
    const keyId = resolveKeyId(ctx)
    if (keyId && !result.isError) {
      const admin = createAdminClient()
      if (admin) await incrementMcpRead(admin, keyId, weightOf(args))
    }
    return result
  }) as McpTool<A, C>["handler"]

  return { ...tool, handler }
}

/** Wrap a WRITE tool so the daily quota is checked and incremented BEFORE the inner
 *  handler ever runs. Fail-closed: no resolvable key id, no admin client, or a quota-check
 *  error all block the write — do not change this to fail open (see the asymmetry note on
 *  lib/vault/mcp-usage.ts's tryIncrementMcpWrite). */
export function withWriteQuota<A, C>(tool: McpTool<A, C>): McpTool<A, C> {
  return {
    ...tool,
    handler: async (args: A, ctx: McpAuthContext) => {
      const keyId = resolveKeyId(ctx)
      if (!keyId) {
        return toolError(new VaultError("AUTH_REQUIRED", "MCP write tools require an API-key Bearer token."))
      }
      const admin = createAdminClient()
      if (!admin) {
        return toolError(new VaultError("NOT_CONFIGURED", "Vault MCP is not configured on this server."))
      }
      const limit = writeDailyLimit()
      try {
        const quota = await tryIncrementMcpWrite(admin, keyId, limit)
        if (!quota.allowed) {
          return toolError(new VaultError("WRITE_QUOTA_EXCEEDED", `Daily write limit of ${limit} reached for this key.`))
        }
      } catch (err) {
        return toolError(new VaultError("DB_ERROR", err instanceof Error ? err.message : "Write quota check failed."))
      }
      return tool.handler(args, ctx)
    },
  }
}
