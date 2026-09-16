// Deliberately NOT marked "server-only", matching lib/vault/http.ts's existing exception
// to that rule: the bare "server-only" specifier has no top-level node_modules/server-only
// in this repo (only Next's own compiled internal shim, resolved via a bundler-only
// alias), so a file that imports it can't be unit-tested with plain `vitest run`. This is
// the one function in the GitHub connector worth testing without a live webhook secret,
// so it lives outside the server-only boundary that the rest of lib/integrations/github/
// otherwise correctly enforces. node:crypto's own presence keeps this out of client
// bundles in practice regardless.

import { createHmac, timingSafeEqual } from "node:crypto"

/** Verify webhook payload authenticity: HMAC-SHA256 over the raw body, using the
 *  constant-time comparator node:crypto provides — a naive `===` here would leak timing
 *  information about how many leading bytes matched. */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | undefined
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false
  if (!secret) return false

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex")
  const provided = signatureHeader.slice("sha256=".length)

  const expectedBuf = Buffer.from(expected, "hex")
  const providedBuf = Buffer.from(provided, "hex")
  if (expectedBuf.length !== providedBuf.length) return false
  return timingSafeEqual(expectedBuf, providedBuf)
}
