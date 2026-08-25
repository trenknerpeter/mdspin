import "server-only"

// Adapts lib/vault's existing dual-auth resolver (Stage 2b) to mcp-handler's
// withMcpAuth verifyToken contract. mcp-handler hands verifyToken the raw Request; its
// .headers already satisfies AuthenticatableRequest (lib/vault/server.ts), so this is
// pure delegation — no new auth logic, extending the Cloud Knowledge Hub strategy doc's
// "shared repo core" principle to the MCP surface.

import { getVaultForRequest } from "@/lib/vault/server"
import type { AuthInfo } from "@modelcontextprotocol/server"

export async function verifyToken(req: Request): Promise<AuthInfo | undefined> {
  try {
    const { scope, keyId } = await getVaultForRequest(req)
    return {
      token: "",
      clientId: scope.userId,
      scopes: ["vault:read"],
      extra: keyId ? { keyId } : undefined,
    }
  } catch {
    return undefined
  }
}
