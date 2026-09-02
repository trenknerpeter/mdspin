import { describe, it, expect, vi, beforeEach } from "vitest"

// vi.mock factories are hoisted above any top-level const, so the mocked fns/objects they
// close over must be created inside vi.hoisted() — otherwise they're referenced in their
// TDZ ("Cannot access '...' before initialization") the moment the mocked module loads.
const { incrementMcpRead, tryIncrementMcpWrite, adminClient, createAdminClient } = vi.hoisted(() => {
  const incrementMcpRead = vi.fn().mockResolvedValue(undefined)
  const tryIncrementMcpWrite = vi.fn()
  const adminClient = { rpc: vi.fn() }
  const createAdminClient = vi.fn(() => adminClient)
  return { incrementMcpRead, tryIncrementMcpWrite, adminClient, createAdminClient }
})
vi.mock("@/lib/vault/mcp-usage", () => ({ incrementMcpRead, tryIncrementMcpWrite }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }))

import { withReadUsageTracking, withWriteQuota } from "@/lib/mcp/writeGuards"

const CTX_WITH_KEY = { http: { authInfo: { clientId: "u1", extra: { keyId: "k1" } } } }
const CTX_NO_KEY = { http: { authInfo: { clientId: "u1" } } }

beforeEach(() => {
  incrementMcpRead.mockClear()
  tryIncrementMcpWrite.mockClear()
  createAdminClient.mockClear()
})

describe("withReadUsageTracking", () => {
  it("meters a successful call at the given weight", async () => {
    const tool = { name: "t", config: {}, handler: vi.fn().mockResolvedValue({ content: [] }) }
    const wrapped = withReadUsageTracking(tool, () => 5)
    await wrapped.handler({}, CTX_WITH_KEY)
    expect(incrementMcpRead).toHaveBeenCalledWith(adminClient, "k1", 5)
  })

  it("does not meter when there's no resolvable key id", async () => {
    const tool = { name: "t", config: {}, handler: vi.fn().mockResolvedValue({ content: [] }) }
    const wrapped = withReadUsageTracking(tool)
    await wrapped.handler({}, CTX_NO_KEY)
    expect(incrementMcpRead).not.toHaveBeenCalled()
  })

  it("does not meter an isError result", async () => {
    const tool = { name: "t", config: {}, handler: vi.fn().mockResolvedValue({ content: [], isError: true }) }
    const wrapped = withReadUsageTracking(tool)
    await wrapped.handler({}, CTX_WITH_KEY)
    expect(incrementMcpRead).not.toHaveBeenCalled()
  })
})

describe("withWriteQuota", () => {
  it("calls the inner handler when the quota allows", async () => {
    tryIncrementMcpWrite.mockResolvedValue({ allowed: true, writeCount: 1, remaining: 199 })
    const inner = vi.fn().mockResolvedValue({ content: [{ type: "text", text: "ok" }] })
    const tool = { name: "t", config: {}, handler: inner }
    const wrapped = withWriteQuota(tool)
    const result = await wrapped.handler({}, CTX_WITH_KEY)
    expect(inner).toHaveBeenCalled()
    expect(result).toEqual({ content: [{ type: "text", text: "ok" }] })
  })

  it("blocks with WRITE_QUOTA_EXCEEDED when the quota is exhausted, without calling the inner handler", async () => {
    tryIncrementMcpWrite.mockResolvedValue({ allowed: false, writeCount: 200, remaining: 0 })
    const inner = vi.fn()
    const tool = { name: "t", config: {}, handler: inner }
    const wrapped = withWriteQuota(tool)
    const result = await wrapped.handler({}, CTX_WITH_KEY)
    expect(inner).not.toHaveBeenCalled()
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("WRITE_QUOTA_EXCEEDED")
  })

  it("blocks with AUTH_REQUIRED when there's no resolvable key id (fail closed)", async () => {
    const inner = vi.fn()
    const tool = { name: "t", config: {}, handler: inner }
    const wrapped = withWriteQuota(tool)
    const result = await wrapped.handler({}, CTX_NO_KEY)
    expect(inner).not.toHaveBeenCalled()
    expect(result.content[0].text).toContain("AUTH_REQUIRED")
  })
})
