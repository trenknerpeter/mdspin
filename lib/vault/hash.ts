// Content hashing for ingest dedup.
//
// Hashing the NORMALIZED body (not the raw file) is the whole point: re-exporting the
// same note from Obsidian on Windows, or an editor adding a trailing newline, must not
// create a duplicate. Frontmatter is excluded so that editing metadata doesn't orphan
// the hash — two files with identical bodies and different frontmatter are the same doc.

import { splitFrontmatter } from "./frontmatter"

/**
 * Canonicalise a document body for hashing:
 *   - frontmatter removed
 *   - CRLF / lone CR -> LF
 *   - trailing whitespace stripped per line
 *   - leading/trailing blank lines trimmed
 */
export function normalizeForHash(input: string): string {
  const { body } = splitFrontmatter(input)
  return body
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "")
}

/**
 * SHA-256 hex of a string, via WebCrypto (available in both browsers and Node 18+).
 *
 * Returns null when crypto.subtle is unavailable — which happens on a plain `http://`
 * origin that isn't localhost (an insecure context, e.g. testing on a LAN IP). Callers
 * must treat null as "let the server compute this", not as an error: the server has the
 * body anyway. Crashing the whole import over a dev-environment quirk would be worse.
 */
export async function sha256Hex(input: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) return null
  const bytes = new TextEncoder().encode(input)
  const digest = await subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/** Convenience: normalize then hash. */
export async function contentHash(input: string): Promise<string | null> {
  return sha256Hex(normalizeForHash(input))
}
