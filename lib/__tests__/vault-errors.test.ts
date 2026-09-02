import { describe, it, expect } from "vitest"
import { VaultError } from "@/lib/vault/errors"

describe("VaultError", () => {
  it("maps each code to the HTTP status a REST route should send", () => {
    expect(new VaultError("AUTH_REQUIRED", "x").status).toBe(401)
    expect(new VaultError("NOT_CONFIGURED", "x").status).toBe(503)
    expect(new VaultError("NOT_FOUND", "x").status).toBe(404)
    expect(new VaultError("INVALID_REQUEST", "x").status).toBe(400)
    expect(new VaultError("VERSION_CONFLICT", "x").status).toBe(409)
    expect(new VaultError("DB_ERROR", "x").status).toBe(500)
  })

  it("toResponse() matches app/api/brief/route.ts's {error, message} convention", () => {
    const err = new VaultError("NOT_FOUND", "Doc not found.")
    expect(err.toResponse()).toEqual({ error: "NOT_FOUND", message: "Doc not found." })
  })

  it("is a real Error — message and stack still work for logging", () => {
    const err = new VaultError("DB_ERROR", "connection reset")
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe("connection reset")
    expect(err.name).toBe("VaultError")
  })

  it("maps IMMUTABLE_SOURCE to 409", () => {
    const err = new VaultError("IMMUTABLE_SOURCE", "cannot replace")
    expect(err.status).toBe(409)
    expect(err.toResponse()).toEqual({ error: "IMMUTABLE_SOURCE", message: "cannot replace" })
  })

  it("maps SUSPICIOUS_SHRINK to 409", () => {
    expect(new VaultError("SUSPICIOUS_SHRINK", "too short").status).toBe(409)
  })

  it("maps WRITE_QUOTA_EXCEEDED to 429", () => {
    expect(new VaultError("WRITE_QUOTA_EXCEEDED", "too many writes").status).toBe(429)
  })
})
