import { describe, it, expect } from "vitest"
import { createHmac } from "node:crypto"
import { verifyWebhookSignature } from "../webhook-signature"

const SECRET = "test-secret"

function sign(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`
}

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed payload", () => {
    const body = JSON.stringify({ hello: "world" })
    expect(verifyWebhookSignature(body, sign(body, SECRET), SECRET)).toBe(true)
  })

  it("rejects a payload signed with the wrong secret", () => {
    const body = JSON.stringify({ hello: "world" })
    expect(verifyWebhookSignature(body, sign(body, "wrong-secret"), SECRET)).toBe(false)
  })

  it("rejects a tampered body even with a validly-formatted signature", () => {
    const original = JSON.stringify({ hello: "world" })
    const tampered = JSON.stringify({ hello: "mallory" })
    expect(verifyWebhookSignature(tampered, sign(original, SECRET), SECRET)).toBe(false)
  })

  it("rejects a missing signature header", () => {
    expect(verifyWebhookSignature("{}", null, SECRET)).toBe(false)
  })

  it("rejects a signature header missing the sha256= prefix", () => {
    const body = "{}"
    const raw = createHmac("sha256", SECRET).update(body).digest("hex")
    expect(verifyWebhookSignature(body, raw, SECRET)).toBe(false)
  })

  it("fails closed when no secret is configured, rather than skipping verification", () => {
    const body = JSON.stringify({ hello: "world" })
    expect(verifyWebhookSignature(body, sign(body, SECRET), undefined)).toBe(false)
  })

  it("rejects a signature of a different length without throwing", () => {
    expect(verifyWebhookSignature("{}", "sha256=deadbeef", SECRET)).toBe(false)
  })
})
