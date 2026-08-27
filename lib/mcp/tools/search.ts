import { z } from "zod"
import { repoForContext, type McpAuthContext } from "@/lib/mcp/context"
import { compactSearchResult } from "@/lib/mcp/format"
import { toolError } from "@/lib/mcp/errors"
import type { VaultRepo } from "@/lib/vault/repo"

const MCP_SEARCH_LIMIT_MAX = 25
const MCP_SEARCH_LIMIT_DEFAULT = 10

export async function runSearch(
  repo: VaultRepo,
  args: { query: string; project_id?: string; tags?: string[]; limit?: number }
) {
  const limit = Math.min(args.limit ?? MCP_SEARCH_LIMIT_DEFAULT, MCP_SEARCH_LIMIT_MAX)
  const page = await repo.searchDocuments(args.query, { projectId: args.project_id, tags: args.tags, limit })
  return { results: page.data.map(compactSearchResult), total: page.page.total }
}

export const searchVaultTool = {
  name: "search_vault",
  config: {
    title: "Search vault",
    description:
      "Search your vault by keyword AND meaning — natural-language questions and paraphrases work, not just exact keywords (hybrid ranking). Returns short snippets and a relevance score, never full document bodies.",
    inputSchema: z.object({
      query: z.string().min(1),
      project_id: z.uuid().optional(),
      tags: z.array(z.string()).optional(),
      limit: z.number().int().positive().optional(),
    }),
  },
  handler: async (
    args: { query: string; project_id?: string; tags?: string[]; limit?: number },
    ctx: McpAuthContext
  ) => {
    try {
      const result = await runSearch(repoForContext(ctx), args)
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] }
    } catch (err) {
      return toolError(err)
    }
  },
}
