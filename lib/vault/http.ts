// The one place a caught error becomes an HTTP response for the REST layer (Stage 2d).
// Every route handler's catch block is one call to this. Deliberately NOT marked
// "server-only": that bare specifier has no top-level node_modules/server-only in this
// repo (only next/dist/compiled/server-only, resolved via a Next-bundler-only alias), so
// a file that imports it can't be unit-tested with plain `vitest run`. Its own
// `next/server` import already keeps it out of client bundles in practice.

import { NextResponse } from "next/server"
import { VaultError } from "./errors"

export function vaultErrorResponse(err: unknown): NextResponse {
  if (err instanceof VaultError) {
    const headers = err.code === "AUTH_REQUIRED" ? { "WWW-Authenticate": "Bearer" } : undefined
    return NextResponse.json(err.toResponse(), { status: err.status, headers })
  }
  console.error("[vault REST] unexpected error:", err)
  return NextResponse.json({ error: "INTERNAL_ERROR", message: "Unexpected error." }, { status: 500 })
}
