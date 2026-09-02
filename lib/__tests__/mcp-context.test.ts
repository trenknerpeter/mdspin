import { describe, it, expect } from "vitest"
import { resolveUserId, resolveKeyId } from "@/lib/mcp/context"

describe("resolveUserId", () => {
  it("reads clientId from ctx.http.authInfo", () => {
    expect(resolveUserId({ http: { authInfo: { clientId: "user-123" } } })).toBe("user-123")
  })
  it("throws when authInfo is missing (withMcpAuth misconfigured)", () => {
    expect(() => resolveUserId({})).toThrow(/authInfo/)
  })
  it("throws when clientId is empty", () => {
    expect(() => resolveUserId({ http: { authInfo: { clientId: "" } } })).toThrow()
  })
})

describe("resolveKeyId", () => {
  it("reads keyId from ctx.http.authInfo.extra", () => {
    const ctx = { http: { authInfo: { clientId: "u1", extra: { keyId: "k1" } } } }
    expect(resolveKeyId(ctx)).toBe("k1")
  })

  it("returns undefined when extra.keyId is absent or not a string", () => {
    expect(resolveKeyId({ http: { authInfo: { clientId: "u1" } } })).toBeUndefined()
    expect(resolveKeyId({ http: { authInfo: { clientId: "u1", extra: { keyId: 123 } } } })).toBeUndefined()
    expect(resolveKeyId({})).toBeUndefined()
  })
})
