import { describe, it, expect } from "vitest"
import { vaultErrorResponse } from "@/lib/vault/http"
import { VaultError } from "@/lib/vault/errors"

describe("vaultErrorResponse", () => {
  it("maps a VaultError to its status and {error,message} body", async () => {
    const res = vaultErrorResponse(new VaultError("NOT_FOUND", "Doc not found."))
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: "NOT_FOUND", message: "Doc not found." })
  })

  it("adds WWW-Authenticate only for AUTH_REQUIRED", () => {
    const authRes = vaultErrorResponse(new VaultError("AUTH_REQUIRED", "Sign in first."))
    expect(authRes.headers.get("WWW-Authenticate")).toBe("Bearer")

    const notFoundRes = vaultErrorResponse(new VaultError("NOT_FOUND", "x"))
    expect(notFoundRes.headers.get("WWW-Authenticate")).toBeNull()
  })

  it("maps every remaining VaultErrorCode to the right status", () => {
    expect(vaultErrorResponse(new VaultError("NOT_CONFIGURED", "x")).status).toBe(503)
    expect(vaultErrorResponse(new VaultError("INVALID_REQUEST", "x")).status).toBe(400)
    expect(vaultErrorResponse(new VaultError("VERSION_CONFLICT", "x")).status).toBe(409)
    expect(vaultErrorResponse(new VaultError("DB_ERROR", "x")).status).toBe(500)
  })

  it("maps a non-VaultError to a generic 500 without leaking its message", async () => {
    const res = vaultErrorResponse(new Error("raw secret db connection string"))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body).toEqual({ error: "INTERNAL_ERROR", message: "Unexpected error." })
  })
})
