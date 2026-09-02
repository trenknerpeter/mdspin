// Usage metering for the MCP write surface (Stage 4). Deliberately separate from
// lib/vault/repo.ts: these two RPCs are keyed by api_keys.id directly, not by the
// per-user VaultScope every VaultRepo method is scoped to, so they don't belong on the
// VaultRepo interface.

import type { SupabaseClient } from "@supabase/supabase-js"

export interface WriteQuotaResult {
  allowed: boolean
  writeCount: number
  remaining: number
}

/** Fail-open, per the Cloud Knowledge Hub strategy's Stage 4 rule ("open for reads") —
 *  reads have no quota to enforce, so a metering failure here must never surface to the
 *  caller or block the read that's already succeeded. Logged, not thrown. */
export async function incrementMcpRead(client: SupabaseClient, keyId: string, weight = 1): Promise<void> {
  const { error } = await client.rpc("increment_mcp_read", { p_key_id: keyId, p_weight: weight })
  if (error) console.error("[mcp-usage] read increment failed:", error.message)
}

/** Fail-CLOSED, unlike incrementMcpRead above — a metering failure must not let an
 *  unmetered write through silently. Do not "fix" this asymmetry to fail open; it's
 *  deliberate (Stage 4's "fail closed for writes, open for reads" rule). */
export async function tryIncrementMcpWrite(
  client: SupabaseClient,
  keyId: string,
  dailyLimit: number
): Promise<WriteQuotaResult> {
  const { data, error } = await client.rpc("try_increment_mcp_write", {
    p_key_id: keyId,
    p_daily_limit: dailyLimit,
  })
  if (error) throw new Error(`mcp write quota check failed: ${error.message}`)
  const row = (data ?? [])[0] as { allowed: boolean; write_count: number; remaining: number } | undefined
  if (!row) throw new Error("try_increment_mcp_write returned no row")
  return { allowed: row.allowed, writeCount: row.write_count, remaining: row.remaining }
}
