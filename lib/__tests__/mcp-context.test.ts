import { describe, it, expect } from "vitest"
import { resolveUserId } from "@/lib/mcp/context"

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
