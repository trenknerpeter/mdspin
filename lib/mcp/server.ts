import type { McpServer } from "@modelcontextprotocol/server"
import { vaultOverviewTool } from "@/lib/mcp/tools/overview"
import { searchVaultTool } from "@/lib/mcp/tools/search"
import { getDocumentTool, listDocumentsTool } from "@/lib/mcp/tools/documents"
import { listProjectsTool, getProjectTool, getRelatedDocumentsTool } from "@/lib/mcp/tools/projects"
import { researchProjectPrompt } from "@/lib/mcp/prompts/researchProject"

export function registerVaultServer(server: McpServer) {
  server.registerTool(vaultOverviewTool.name, vaultOverviewTool.config, vaultOverviewTool.handler)
  server.registerTool(searchVaultTool.name, searchVaultTool.config, searchVaultTool.handler)
  server.registerTool(getDocumentTool.name, getDocumentTool.config, getDocumentTool.handler)
  server.registerTool(listDocumentsTool.name, listDocumentsTool.config, listDocumentsTool.handler)
  server.registerTool(listProjectsTool.name, listProjectsTool.config, listProjectsTool.handler)
  server.registerTool(getProjectTool.name, getProjectTool.config, getProjectTool.handler)
  server.registerTool(getRelatedDocumentsTool.name, getRelatedDocumentsTool.config, getRelatedDocumentsTool.handler)
  server.registerPrompt(researchProjectPrompt.name, researchProjectPrompt.config, researchProjectPrompt.handler)
}
