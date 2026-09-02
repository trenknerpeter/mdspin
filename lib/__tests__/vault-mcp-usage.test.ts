import { describe, it, expect, vi } from "vitest"
import { incrementMcpRead, tryIncrementMcpWrite } from "@/lib/vault/mcp-usage"

function fakeClient(rpcResult: unknown) {
  return { rpc: vi.fn().mockResolvedValue(rpcResult) } as unknown as import("@supabase/supabase-js").SupabaseClient
}

describe("incrementMcpRead", () => {
  it("calls increment_mcp_read with the key id and weight", async () => {
    const client = fakeClient({ data: null, error: null })
    await incrementMcpRead(client, "k1", 5)
    expect(client.rpc).toHaveBeenCalledWith("increment_mcp_read", { p_key_id: "k1", p_weight: 5 })
  })

  it("swallows an RPC error rather than throwing (fail open for reads)", async () => {
    const client = fakeClient({ data: null, error: { message: "boom" } })
    await expect(incrementMcpRead(client, "k1", 1)).resolves.toBeUndefined()
  })
})

describe("tryIncrementMcpWrite", () => {
  it("returns the allowed/write_count/remaining row on success", async () => {
    const client = fakeClient({ data: [{ allowed: true, write_count: 3, remaining: 197 }], error: null })
    const result = await tryIncrementMcpWrite(client, "k1", 200)
    expect(result).toEqual({ allowed: true, writeCount: 3, remaining: 197 })
    expect(client.rpc).toHaveBeenCalledWith("try_increment_mcp_write", { p_key_id: "k1", p_daily_limit: 200 })
  })

  it("throws on an RPC error (fail closed for writes)", async () => {
    const client = fakeClient({ data: null, error: { message: "boom" } })
    await expect(tryIncrementMcpWrite(client, "k1", 200)).rejects.toThrow(/boom/)
  })
})
