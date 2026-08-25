import type { McpServer, ServerContext, CallToolResult, GetPromptResult } from "@modelcontextprotocol/server"
import { vaultOverviewTool } from "@/lib/mcp/tools/overview"
import { searchVaultTool } from "@/lib/mcp/tools/search"
import { getDocumentTool, listDocumentsTool } from "@/lib/mcp/tools/documents"
import { listProjectsTool, getProjectTool, getRelatedDocumentsTool } from "@/lib/mcp/tools/projects"
import { researchProjectPrompt } from "@/lib/mcp/prompts/researchProject"
import type { McpAuthContext } from "@/lib/mcp/context"

/**
 * Extracts auth context from ServerContext for tool/prompt handlers.
 * Handlers are typed to accept McpAuthContext (narrower, custom interface),
 * but the SDK provides ServerContext (broader, with mcpReq, http.authInfo, etc.).
 * We extract just the http field which contains the authInfo our handlers need.
 */
function adaptContext(ctx: ServerContext): McpAuthContext {
  return { http: ctx.http }
}

export function registerVaultServer(server: McpServer) {
  // Tools without arguments: adapt ServerContext to McpAuthContext, cast result to CallToolResult
  server.registerTool(
    vaultOverviewTool.name,
    vaultOverviewTool.config,
    (async (ctx: ServerContext): Promise<CallToolResult> => {
      return vaultOverviewTool.handler(adaptContext(ctx)) as unknown as CallToolResult
    })
  )

  server.registerTool(
    listProjectsTool.name,
    listProjectsTool.config,
    (async (ctx: ServerContext): Promise<CallToolResult> => {
      return listProjectsTool.handler(adaptContext(ctx)) as unknown as CallToolResult
    })
  )

  // Tools with arguments: adapt ServerContext to McpAuthContext, cast result to CallToolResult
  server.registerTool(
    searchVaultTool.name,
    searchVaultTool.config,
    (async (args: Record<string, unknown>, ctx: ServerContext): Promise<CallToolResult> => {
      return searchVaultTool.handler(
        args as Parameters<typeof searchVaultTool.handler>[0],
        adaptContext(ctx)
      ) as unknown as CallToolResult
    })
  )

  server.registerTool(
    getDocumentTool.name,
    getDocumentTool.config,
    (async (args: Record<string, unknown>, ctx: ServerContext): Promise<CallToolResult> => {
      return getDocumentTool.handler(
        args as Parameters<typeof getDocumentTool.handler>[0],
        adaptContext(ctx)
      ) as unknown as CallToolResult
    })
  )

  server.registerTool(
    listDocumentsTool.name,
    listDocumentsTool.config,
    (async (args: Record<string, unknown>, ctx: ServerContext): Promise<CallToolResult> => {
      return listDocumentsTool.handler(
        args as Parameters<typeof listDocumentsTool.handler>[0],
        adaptContext(ctx)
      ) as unknown as CallToolResult
    })
  )

  server.registerTool(
    getProjectTool.name,
    getProjectTool.config,
    (async (args: Record<string, unknown>, ctx: ServerContext): Promise<CallToolResult> => {
      return getProjectTool.handler(
        args as Parameters<typeof getProjectTool.handler>[0],
        adaptContext(ctx)
      ) as unknown as CallToolResult
    })
  )

  server.registerTool(
    getRelatedDocumentsTool.name,
    getRelatedDocumentsTool.config,
    (async (args: Record<string, unknown>, ctx: ServerContext): Promise<CallToolResult> => {
      return getRelatedDocumentsTool.handler(
        args as Parameters<typeof getRelatedDocumentsTool.handler>[0],
        adaptContext(ctx)
      ) as unknown as CallToolResult
    })
  )

  // Prompt with arguments: adapt ServerContext to McpAuthContext, cast result to GetPromptResult
  server.registerPrompt(
    researchProjectPrompt.name,
    researchProjectPrompt.config,
    (async (args: Record<string, unknown>, ctx: ServerContext): Promise<GetPromptResult> => {
      return researchProjectPrompt.handler(
        args as Parameters<typeof researchProjectPrompt.handler>[0],
        adaptContext(ctx)
      ) as unknown as GetPromptResult
    })
  )
}
