import type { McpServer, ServerContext } from "@modelcontextprotocol/server"
import { vaultOverviewTool } from "@/lib/mcp/tools/overview"
import { searchVaultTool } from "@/lib/mcp/tools/search"
import { getDocumentTool, listDocumentsTool } from "@/lib/mcp/tools/documents"
import { listProjectsTool, getProjectTool, getRelatedDocumentsTool } from "@/lib/mcp/tools/projects"
import { researchProjectPrompt } from "@/lib/mcp/prompts/researchProject"
import type { McpAuthContext } from "@/lib/mcp/context"

// Adapter to convert ServerContext to McpAuthContext
// The MCP SDK provides ServerContext with http.authInfo that we need to map
function adaptToAuthContext(ctx: ServerContext): McpAuthContext {
  return {
    http: ctx.http,
  }
}

export function registerVaultServer(server: McpServer) {
  // Register tools with adapter wrappers that convert ServerContext to McpAuthContext
  // Note: handlers are typed for McpAuthContext but SDK expects ServerContext
  // At runtime, ServerContext.http provides the auth info our handlers need
  server.registerTool(
    vaultOverviewTool.name,
    vaultOverviewTool.config,
    (async (ctx: ServerContext) => vaultOverviewTool.handler(adaptToAuthContext(ctx))) as unknown as never
  )

  server.registerTool(
    searchVaultTool.name,
    searchVaultTool.config,
    (async (args: Record<string, unknown>, ctx: ServerContext) =>
      searchVaultTool.handler(args as Parameters<typeof searchVaultTool.handler>[0], adaptToAuthContext(ctx))) as unknown as never
  )

  server.registerTool(
    getDocumentTool.name,
    getDocumentTool.config,
    (async (args: Record<string, unknown>, ctx: ServerContext) =>
      getDocumentTool.handler(args as Parameters<typeof getDocumentTool.handler>[0], adaptToAuthContext(ctx))) as unknown as never
  )

  server.registerTool(
    listDocumentsTool.name,
    listDocumentsTool.config,
    (async (args: Record<string, unknown>, ctx: ServerContext) =>
      listDocumentsTool.handler(args as Parameters<typeof listDocumentsTool.handler>[0], adaptToAuthContext(ctx))) as unknown as never
  )

  server.registerTool(
    listProjectsTool.name,
    listProjectsTool.config,
    (async (ctx: ServerContext) => listProjectsTool.handler(adaptToAuthContext(ctx))) as unknown as never
  )

  server.registerTool(
    getProjectTool.name,
    getProjectTool.config,
    (async (args: Record<string, unknown>, ctx: ServerContext) =>
      getProjectTool.handler(args as Parameters<typeof getProjectTool.handler>[0], adaptToAuthContext(ctx))) as unknown as never
  )

  server.registerTool(
    getRelatedDocumentsTool.name,
    getRelatedDocumentsTool.config,
    (async (args: Record<string, unknown>, ctx: ServerContext) =>
      getRelatedDocumentsTool.handler(args as Parameters<typeof getRelatedDocumentsTool.handler>[0], adaptToAuthContext(ctx))) as unknown as never
  )

  server.registerPrompt(
    researchProjectPrompt.name,
    researchProjectPrompt.config,
    (async (args: Record<string, unknown>, ctx: ServerContext) =>
      researchProjectPrompt.handler(args as Parameters<typeof researchProjectPrompt.handler>[0], adaptToAuthContext(ctx))) as unknown as never
  )
}
