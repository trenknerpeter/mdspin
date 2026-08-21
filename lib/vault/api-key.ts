// Pure API-key parsing and hashing. Kept out of auth.ts (which needs next/headers and a
// database client) so the hashing algorithm itself is unit-testable and greppable in
// isolation — see the PARITY note below, which is the whole reason this file is separate.

import { sha256Hex } from "./hash"

// "absent" (no header at all) and "malformed" (a header that isn't `Bearer <token>`) are
// deliberately distinct: auth.ts falls back to the cookie session for "absent" but fails
// closed with AUTH_REQUIRED for "malformed" — a caller that TRIED to authenticate and got
// the scheme wrong should not silently succeed via whatever cookie happens to be present.
export type AuthHeaderKind = "api_key" | "jwt" | "absent" | "malformed"

export interface ParsedAuthHeader {
  kind: AuthHeaderKind
  token: string | null
}

/** mdspin_ is the prefix shown throughout the developer docs (app/developer-api) and
 *  minted by mdc-api, never by this repo. Anything else on a Bearer header is treated as
 *  a Supabase JWT — see auth.ts. */
const API_KEY_PREFIX = "mdspin_"

export function parseAuthHeader(header: string | null): ParsedAuthHeader {
  if (!header) return { kind: "absent", token: null }
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  if (!match) return { kind: "malformed", token: null }
  const token = match[1].trim()
  if (!token) return { kind: "malformed", token: null }
  return { kind: token.startsWith(API_KEY_PREFIX) ? "api_key" : "jwt", token }
}

/**
 * PARITY: this MUST match mdc-api's key-hashing exactly, or every API key issued by
 * mdc-api will fail to authenticate here even though it's valid. mdc-api mints and
 * verifies these keys in a separate repo (`mdc-api/src/lib/oauthHelpers.js`, per the
 * Cloud Knowledge Hub strategy doc); this frontend has no filesystem access to that repo
 * to verify byte-for-byte and IMPLEMENTS THIS FROM THE STRATEGY DOC'S DESCRIPTION
 * ("sha256(token) hex"), not from reading the source. Treat this as unverified until
 * confirmed live against a real mdc-api-issued key — see the fixture test in
 * lib/__tests__/vault-api-key.test.ts, which pins the algorithm (plain SHA-256 hex of the
 * raw token, no salt, no prefix stripped) so a mismatch is a one-line diff to spot, not a
 * silent 401 on every request.
 *
 * Throws rather than returning null on a crypto failure: unlike lib/vault/hash.ts's
 * content-hashing use of the same primitive (where "let the server compute this later" is
 * a safe fallback), THIS caller IS the server — there is no later, and letting a hash
 * failure silently produce `null` here would risk a bug elsewhere treating it as "no key
 * hash to compare", which is a fail-OPEN shape for something that must fail closed.
 */
export async function hashApiKey(token: string): Promise<string> {
  const digest = await sha256Hex(token)
  if (!digest) {
    throw new Error("sha256Hex returned null — crypto.subtle unavailable in this runtime.")
  }
  return digest
}
