import { z } from "zod"
import { repoForContext, type McpAuthContext } from "@/lib/mcp/context"
import { compactDocMeta, compactHeading } from "@/lib/mcp/format"
import { toolError } from "@/lib/mcp/errors"
import { extractHeadings } from "@/lib/vault/title"
import { VaultError } from "@/lib/vault/errors"
import type { VaultRepo } from "@/lib/vault/repo"
import type { DocumentCursor } from "@/lib/vault/types"

// Matches the vault UI's own preview-chunk convention (PREVIEW_CAP) as the default
// window size for a "full" content fetch — not an arbitrary new number.
const FULL_CONTENT_DEFAULT_LIMIT = 8000

// Hard ceiling for a single "full" content window. Every other size knob in this surface
// is capped (search_vault clamps to 25 in code; list_documents/get_related_documents are
// clamped in the repo layer) — without this a client could ask for a whole 2.4MB document
// per id and blow the token-economy budget the whole tool set is built around.
const MAX_FULL_CONTENT_LIMIT = 50_000

type ContentMode = "none" | "summary" | "outline" | "full"

async function buildDocumentEntry(
  repo: VaultRepo,
  id: string,
  content: ContentMode,
  offset: number,
  limit: number
): Promise<Record<string, unknown>> {
  const needsMarkdown = content === "full" || content === "outline"
  const doc = await repo.getDocument(id, { includeMarkdown: needsMarkdown })
  if (!doc) return { id, error: "not found" }

  const meta = compactDocMeta(doc)
  if (content === "none") return meta

  if (content === "summary") {
    return { ...meta, summary: doc.summaryStatus === "ready" ? doc.summary : null, summary_status: doc.summaryStatus }
  }

  if (content === "outline") {
    return { ...meta, headings: extractHeadings(doc.markdown ?? "").map(compactHeading) }
  }

  // content === "full"
  const full = doc.markdown ?? ""
  const slice = full.slice(offset, offset + limit)
  const returnedEnd = offset + slice.length
  return {
    ...meta,
    markdown: slice,
    content_range: {
      offset,
      returned: slice.length,
      total: full.length,
      truncated: returnedEnd < full.length,
      next_offset: returnedEnd < full.length ? returnedEnd : null,
    },
  }
}

export async function buildGetDocumentResult(
  repo: VaultRepo,
  args: { document_ids: string[]; content?: ContentMode; offset?: number; limit?: number }
) {
  const content = args.content ?? "summary"
  const offset = args.offset ?? 0
  // Clamped here, not only in the zod schema: buildGetDocumentResult/buildDocumentEntry are
  // also called directly (tests, and any future non-MCP caller) with unvalidated args.
  const limit = Math.min(args.limit ?? FULL_CONTENT_DEFAULT_LIMIT, MAX_FULL_CONTENT_LIMIT)
  const documents = await Promise.all(args.document_ids.map((id) => buildDocumentEntry(repo, id, content, offset, limit)))
  return { documents }
}

export const getDocumentTool = {
  name: "get_document",
  config: {
    title: "Get document(s)",
    description:
      "Fetch 1-5 documents by id. content='summary' (default) returns metadata + summary; 'none' is metadata only; 'outline' returns headings; 'full' returns the body, paginated via offset/limit — check content_range.truncated to know if you need another call.",
    inputSchema: z.object({
      document_ids: z.array(z.uuid()).min(1).max(5),
      content: z.enum(["none", "summary", "outline", "full"]).optional(),
      offset: z.number().int().min(0).optional(),
      limit: z.number().int().positive().max(MAX_FULL_CONTENT_LIMIT).optional(),
    }),
  },
  handler: async (
    args: { document_ids: string[]; content?: ContentMode; offset?: number; limit?: number },
    ctx: McpAuthContext
  ) => {
    try {
      const result = await buildGetDocumentResult(repoForContext(ctx), args)
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] }
    } catch (err) {
      return toolError(err)
    }
  },
}

function encodeCursor(cursor: DocumentCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64")
}

function decodeCursor(raw: string): DocumentCursor {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"))
    if (typeof parsed?.updatedAt !== "string" || typeof parsed?.id !== "string") {
      throw new Error("malformed cursor shape")
    }
    return parsed
  } catch {
    throw new VaultError("INVALID_REQUEST", "Invalid cursor.")
  }
}

export async function buildListDocumentsResult(
  repo: VaultRepo,
  args: { project_id?: string; tags?: string[]; limit?: number; cursor?: string }
) {
  const cursor = args.cursor ? decodeCursor(args.cursor) : undefined
  const page = await repo.listDocumentsByCursor({
    projectId: args.project_id,
    tags: args.tags,
    limit: args.limit,
    cursor,
  })
  return {
    documents: page.data.map(compactDocMeta),
    next_cursor: page.nextCursor ? encodeCursor(page.nextCursor) : null,
  }
}

export const listDocumentsTool = {
  name: "list_documents",
  config: {
    title: "List documents",
    description:
      "Deterministic, filterable document listing with keyset pagination — pass the previous call's next_cursor to get the next page; a null next_cursor means you've reached the end. Prefer search_vault when you're looking for something specific rather than enumerating.",
    inputSchema: z.object({
      project_id: z.uuid().optional(),
      // supabase-js serializes .overlaps("tags", [...]) as a raw PostgREST array literal
      // ({a,b}) with no per-value escaping, so a tag containing , { } " or \ would either
      // silently split into two tags or produce an opaque array-literal parse error.
      tags: z.array(z.string().regex(/^[^,{}"\\]+$/, 'tag must not contain , { } " or \\')).optional(),
      limit: z.number().int().positive().optional(),
      cursor: z.string().optional(),
    }),
  },
  handler: async (
    args: { project_id?: string; tags?: string[]; limit?: number; cursor?: string },
    ctx: McpAuthContext
  ) => {
    try {
      const result = await buildListDocumentsResult(repoForContext(ctx), args)
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] }
    } catch (err) {
      return toolError(err)
    }
  },
}
