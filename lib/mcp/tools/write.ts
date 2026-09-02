import { z } from "zod"
import { repoForContext, resolveKeyId, type McpAuthContext } from "@/lib/mcp/context"
import { compactDocMeta } from "@/lib/mcp/format"
import { toolError } from "@/lib/mcp/errors"
import type { VaultRepo } from "@/lib/vault/repo"
import type { VaultDocumentPatch } from "@/lib/vault/types"

export async function runCreateDocument(
  repo: VaultRepo,
  args: { title?: string; markdown: string; tags?: string[]; project_id?: string }
) {
  const doc = await repo.createDocument({
    title: args.title ?? null,
    markdown: args.markdown,
    tags: args.tags,
    projectId: args.project_id ?? null,
  })
  return compactDocMeta(doc)
}

export const createDocumentTool = {
  name: "create_document",
  config: {
    title: "Create document",
    description:
      "Create a new vault document. Preferred over update_document when adding new content — this never touches an existing document. Provide a markdown body; title is derived from the first heading when omitted.",
    inputSchema: z.object({
      title: z.string().max(200).optional(),
      markdown: z.string().min(1),
      tags: z.array(z.string()).optional(),
      project_id: z.uuid().optional(),
    }),
  },
  handler: async (
    args: { title?: string; markdown: string; tags?: string[]; project_id?: string },
    ctx: McpAuthContext
  ) => {
    try {
      const result = await runCreateDocument(repoForContext(ctx), args)
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] }
    } catch (err) {
      return toolError(err)
    }
  },
}

export async function runAppendToDocument(
  repo: VaultRepo,
  ctx: McpAuthContext,
  args: { document_id: string; addition: string; reason?: string }
) {
  const doc = await repo.appendToDocument(args.document_id, args.addition, {
    actor: "mcp",
    actorKeyId: resolveKeyId(ctx),
    reason: args.reason,
  })
  return compactDocMeta(doc)
}

export const appendToDocumentTool = {
  name: "append_to_document",
  config: {
    title: "Append to document",
    description:
      "Add content to the end of an existing document without touching what's already there. Non-destructive — the workhorse for adding to a document. Prefer this over update_document whenever you're adding rather than replacing.",
    inputSchema: z.object({
      document_id: z.uuid(),
      addition: z.string().min(1),
      reason: z.string().optional(),
    }),
  },
  handler: async (
    args: { document_id: string; addition: string; reason?: string },
    ctx: McpAuthContext
  ) => {
    try {
      const result = await runAppendToDocument(repoForContext(ctx), ctx, args)
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] }
    } catch (err) {
      return toolError(err)
    }
  },
}

interface UpdateDocumentArgs {
  document_id: string
  title?: string | null
  markdown?: string | null
  tags?: string[]
  project_id?: string | null
  expected_version: number
  reason: string
  confirm_shrink?: boolean
}

export async function runUpdateDocument(repo: VaultRepo, ctx: McpAuthContext, args: UpdateDocumentArgs) {
  const patch: VaultDocumentPatch = {}
  if ("title" in args) patch.title = args.title ?? null
  if ("markdown" in args) patch.markdown = args.markdown ?? null
  if ("tags" in args) patch.tags = args.tags
  if ("project_id" in args) patch.projectId = args.project_id ?? null

  const doc = await repo.updateDocument(args.document_id, patch, {
    expectedVersion: args.expected_version,
    actor: "mcp",
    actorKeyId: resolveKeyId(ctx),
    reason: args.reason,
    confirmShrink: args.confirm_shrink,
  })
  return compactDocMeta(doc)
}

export const updateDocumentTool = {
  name: "update_document",
  config: {
    title: "Update document",
    description:
      "Full replace of title/markdown/tags/project on an existing document. Requires expected_version (read the document first with get_document — this is what makes a blind rewrite structurally impossible) and a reason. Prefer append_to_document when you're adding rather than replacing. Only allowed on notes and MCP-created documents — imported/converted/API-created documents return IMMUTABLE_SOURCE; use append_to_document there instead. If the new content is much shorter than the old, this returns SUSPICIOUS_SHRINK unless confirm_shrink is set.",
    inputSchema: z.object({
      document_id: z.uuid(),
      title: z.string().nullable().optional(),
      markdown: z.string().nullable().optional(),
      tags: z.array(z.string()).optional(),
      project_id: z.uuid().nullable().optional(),
      expected_version: z.number().int(),
      reason: z.string().min(1),
      confirm_shrink: z.boolean().optional(),
    }),
  },
  handler: async (args: UpdateDocumentArgs, ctx: McpAuthContext) => {
    try {
      const result = await runUpdateDocument(repoForContext(ctx), ctx, args)
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] }
    } catch (err) {
      return toolError(err)
    }
  },
}
