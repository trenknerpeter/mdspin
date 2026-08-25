// The MCP-tool mirror of lib/vault/http.ts's vaultErrorResponse — same shape of decision
// (VaultError -> a caller-legible message; anything else -> a generic one, logged not
// leaked), different transport: a tool failure is a SUCCESSFUL JSON-RPC response
// carrying {content, isError: true}, never an uncaught exception the SDK would turn
// into an opaque -32603 the calling model can't act on.

import { VaultError } from "@/lib/vault/errors"

interface ToolTextResult {
  content: Array<{ type: "text"; text: string }>
  isError: true
}

export function toolError(err: unknown): ToolTextResult {
  if (err instanceof VaultError) {
    return { content: [{ type: "text", text: `${err.code}: ${err.message}` }], isError: true }
  }
  console.error("[vault MCP] unexpected error:", err)
  return { content: [{ type: "text", text: "Unexpected error." }], isError: true }
}
