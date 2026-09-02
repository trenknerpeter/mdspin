import type { McpServer } from "@modelcontextprotocol/server"
import { vaultOverviewTool } from "@/lib/mcp/tools/overview"
import { searchVaultTool } from "@/lib/mcp/tools/search"
import { getDocumentTool, listDocumentsTool } from "@/lib/mcp/tools/documents"
import { listProjectsTool, getProjectTool, getRelatedDocumentsTool, createProjectTool, updateProjectTool } from "@/lib/mcp/tools/projects"
import { createDocumentTool, appendToDocumentTool, updateDocumentTool } from "@/lib/mcp/tools/write"
import { organizeDocumentTool, removeFromVaultTool } from "@/lib/mcp/tools/organize"
import { researchProjectPrompt } from "@/lib/mcp/prompts/researchProject"
import { withReadUsageTracking, withWriteQuota } from "@/lib/mcp/writeGuards"

// Stage 4: write tools exist in the bundle unconditionally, but only ever get registered
// on the McpServer — and therefore only ever appear in tools/list — when this is "true".
// Ship false, run the destruction drill, then flip it.
const WRITE_TOOLS_ENABLED = process.env.MCP_WRITE_ENABLED === "true"

export function registerVaultServer(server: McpServer) {
  // vault_overview takes no input (no inputSchema in its config), so the SDK's tool
  // executor calls its handler with a single (ctx-only) argument — see the arity note on
  // withReadUsageTracking in lib/mcp/writeGuards.ts. The wrapped handler dispatches
  // correctly on the real argument count at runtime; the cast below only works around
  // TypeScript's registerTool overloads, which can't express "arity depends on config
  // shape" as a single static callback type.
  const overview = withReadUsageTracking(vaultOverviewTool)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server.registerTool(overview.name, overview.config, overview.handler as any)

  const search = withReadUsageTracking(searchVaultTool)
  server.registerTool(search.name, search.config, search.handler)

  // content:"full" is the real token-economy sink (per the Cloud Knowledge Hub strategy's
  // Stage 4 usage rule) — weighted 5x, everything else on this tool stays at 1.
  const getDocument = withReadUsageTracking(
    getDocumentTool,
    (args: { content?: string }) => (args?.content === "full" ? 5 : 1)
  )
  server.registerTool(getDocument.name, getDocument.config, getDocument.handler)

  const listDocuments = withReadUsageTracking(listDocumentsTool)
  server.registerTool(listDocuments.name, listDocuments.config, listDocuments.handler)

  // list_projects is the other no-input tool — same arity note as vault_overview above.
  const listProjects = withReadUsageTracking(listProjectsTool)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server.registerTool(listProjects.name, listProjects.config, listProjects.handler as any)

  const getProject = withReadUsageTracking(getProjectTool)
  server.registerTool(getProject.name, getProject.config, getProject.handler)

  const getRelatedDocuments = withReadUsageTracking(getRelatedDocumentsTool)
  server.registerTool(getRelatedDocuments.name, getRelatedDocuments.config, getRelatedDocuments.handler)

  if (WRITE_TOOLS_ENABLED) {
    const createDocument = withWriteQuota(createDocumentTool)
    server.registerTool(createDocument.name, createDocument.config, createDocument.handler)

    const appendToDocument = withWriteQuota(appendToDocumentTool)
    server.registerTool(appendToDocument.name, appendToDocument.config, appendToDocument.handler)

    const updateDocument = withWriteQuota(updateDocumentTool)
    server.registerTool(updateDocument.name, updateDocument.config, updateDocument.handler)

    const organizeDocument = withWriteQuota(organizeDocumentTool)
    server.registerTool(organizeDocument.name, organizeDocument.config, organizeDocument.handler)

    const removeFromVault = withWriteQuota(removeFromVaultTool)
    server.registerTool(removeFromVault.name, removeFromVault.config, removeFromVault.handler)

    const createProject = withWriteQuota(createProjectTool)
    server.registerTool(createProject.name, createProject.config, createProject.handler)

    const updateProject = withWriteQuota(updateProjectTool)
    server.registerTool(updateProject.name, updateProject.config, updateProject.handler)
  }

  server.registerPrompt(researchProjectPrompt.name, researchProjectPrompt.config, researchProjectPrompt.handler)
}
