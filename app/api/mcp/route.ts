import { createMcpHandler, withMcpAuth } from "mcp-handler"
import { verifyToken } from "@/lib/mcp/auth"
import { registerVaultServer } from "@/lib/mcp/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const handler = withMcpAuth(
  createMcpHandler(registerVaultServer, { serverInfo: { name: "mdspin-vault", version: "1.0.0" } }),
  verifyToken,
  { required: true }
)

export { handler as GET, handler as POST, handler as DELETE }
