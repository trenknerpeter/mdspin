// lib/safe-redirect.ts
// Validate a `next` redirect target so it can only point to a same-origin path.
// Returns the safe path, or the fallback ("/app") for anything suspicious.
export function safeNext(next: unknown, fallback = "/app"): string {
  if (typeof next !== "string" || next.length === 0) return fallback
  // Must be a root-relative path...
  if (!next.startsWith("/")) return fallback
  // ...but not protocol-relative ("//host") or a backslash variant ("/\host").
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback
  // Reject encoded slashes that could decode into a host-changing path.
  if (/%2f/i.test(next)) return fallback
  // Reject control chars.
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f]/.test(next)) return fallback
  return next
}
