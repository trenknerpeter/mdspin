import "server-only"

// Adapts lib/vault's existing dual-auth resolver (Stage 2b) to mcp-handler's
// withMcpAuth verifyToken contract. mcp-handler hands verifyToken the raw Request; its
// .headers already satisfies AuthenticatableRequest (lib/vault/server.ts), so this is
// pure delegation — no new auth logic, extending the Cloud Knowledge Hub strategy doc's
// "shared repo core" principle to the MCP surface.

import { getVaultForRequest } from "@/lib/vault/server"
import type { AuthInfo } from "@modelcontextprotocol/server"

// withMcpAuth calls this unconditionally, including when the request carries no
// Authorization header (bearerToken === undefined). Bail out in that case: /api/mcp is a
// stateless remote endpoint, so it must authenticate only via an explicit Bearer token,
// never via the Supabase session cookie that getVaultForRequest would otherwise fall back
// to for the browser-facing REST API.
export async function verifyToken(req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined
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
