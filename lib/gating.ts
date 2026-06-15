// lib/gating.ts
// Pure decision logic for the anonymous capability gate. No imports — unit-tested.
//
// Rule: anonymous users may convert a SINGLE file of any supported format.
// URL conversion and multi-file (batch) conversion require sign-in from use #1.

export type ConvertMode = "file" | "url"

export function requiresSignIn(opts: {
  authenticated: boolean
  mode: ConvertMode
  fileCount: number
}): boolean {
  if (opts.authenticated) return false
  if (opts.mode === "url") return true
  if (opts.fileCount > 1) return true
  return false
}
