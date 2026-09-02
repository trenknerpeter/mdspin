import { z } from "zod"
import { repoForContext, resolveKeyId, type McpAuthContext } from "@/lib/mcp/context"
import { compactDocMeta } from "@/lib/mcp/format"
import { toolError } from "@/lib/mcp/errors"
import type { VaultRepo } from "@/lib/vault/repo"

export async function runOrganizeDocument(
  repo: VaultRepo,
  ctx: McpAuthContext,
  args: { document_id: string; add_tags?: string[]; remove_tags?: string[]; reason?: string }
) {
  const doc = await repo.organizeDocument(args.document_id, {
    addTags: args.add_tags,
    removeTags: args.remove_tags,
    actor: "mcp",
    actorKeyId: resolveKeyId(ctx),
    reason: args.reason,
  })
  return compactDocMeta(doc)
}

export const organizeDocumentTool = {
  name: "organize_document",
  config: {
    title: "Organize document tags",
    description:
      "Add and/or remove tags on a document without touching its content. Additive/subtractive only — there is no 'set tags'; pass exactly the tags to add_tags/remove_tags, not the full desired list. To move a document between projects, use update_document's project_id field instead.",
    inputSchema: z.object({
      document_id: z.uuid(),
      add_tags: z.array(z.string()).optional(),
      remove_tags: z.array(z.string()).optional(),
      reason: z.string().optional(),
    }),
  },
  handler: async (
    args: { document_id: string; add_tags?: string[]; remove_tags?: string[]; reason?: string },
    ctx: McpAuthContext
  ) => {
    try {
      const result = await runOrganizeDocument(repoForContext(ctx), ctx, args)
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] }
    } catch (err) {
      return toolError(err)
    }
  },
}

export async function runRemoveFromVault(repo: VaultRepo, args: { document_id: string }) {
  await repo.removeFromVault(args.document_id)
  return { id: args.document_id, removed: true }
}

export const removeFromVaultTool = {
  name: "remove_from_vault",
  config: {
    title: "Remove from vault",
    description:
      "Reversibly remove a document from the vault — it stops appearing in listings and search but is not deleted. There is no delete tool; this is the only removal action available.",
    inputSchema: z.object({ document_id: z.uuid() }),
  },
  handler: async (args: { document_id: string }, ctx: McpAuthContext) => {
    try {
      const result = await runRemoveFromVault(repoForContext(ctx), args)
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] }
    } catch (err) {
      return toolError(err)
    }
  },
}
