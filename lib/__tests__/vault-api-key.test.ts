import { describe, it, expect } from "vitest"
import { parseAuthHeader, hashApiKey } from "@/lib/vault/api-key"

describe("parseAuthHeader", () => {
  it("is 'absent' when there is no header at all", () => {
    expect(parseAuthHeader(null)).toEqual({ kind: "absent", token: null })
  })

  it("is 'malformed' for a header that isn't `Bearer <token>`", () => {
    expect(parseAuthHeader("Basic dXNlcjpwYXNz")).toEqual({ kind: "malformed", token: null })
    expect(parseAuthHeader("Bearer")).toEqual({ kind: "malformed", token: null })
    expect(parseAuthHeader("Bearer   ")).toEqual({ kind: "malformed", token: null })
  })

  it("is 'api_key' for an mdspin_-prefixed bearer token", () => {
    expect(parseAuthHeader("Bearer mdspin_abc123")).toEqual({ kind: "api_key", token: "mdspin_abc123" })
  })

  it("is 'jwt' for any other bearer token", () => {
    expect(parseAuthHeader("Bearer eyJabc.def.ghi")).toEqual({ kind: "jwt", token: "eyJabc.def.ghi" })
  })

  it("is case-insensitive on the Bearer scheme and tolerates extra whitespace", () => {
    expect(parseAuthHeader("bearer   mdspin_x  ")).toEqual({ kind: "api_key", token: "mdspin_x" })
  })
})

describe("hashApiKey", () => {
  // PARITY fixture: a well-known SHA-256 test vector, not a real mdspin_ key. This pins
  // the ALGORITHM (plain sha256 hex, no salt, no prefix stripped) so that if mdc-api's
  // actual hashing turns out to differ, comparing the same input through both
  // implementations is a one-line diff, not a debugging session.
  it("matches the standard SHA-256 hex digest of 'abc'", async () => {
    expect(await hashApiKey("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    )
  })

  it("hashes the RAW token — a real mdspin_ key must not be stripped of its prefix first", async () => {
    const withPrefix = await hashApiKey("mdspin_abc")
    const withoutPrefix = await hashApiKey("abc")
    expect(withPrefix).not.toBe(withoutPrefix)
  })

  it("is deterministic", async () => {
    expect(await hashApiKey("same-input")).toBe(await hashApiKey("same-input"))
  })
})
