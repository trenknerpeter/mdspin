import { z } from "zod"
import { repoForContext, type McpAuthContext } from "@/lib/mcp/context"
import { compactDocMeta, compactHeading } from "@/lib/mcp/format"
import { toolError } from "@/lib/mcp/errors"
import { extractHeadings } from "@/lib/vault/title"
import type { VaultRepo } from "@/lib/vault/repo"

// Matches the vault UI's own preview-chunk convention (PREVIEW_CAP) as the default
// window size for a "full" content fetch — not an arbitrary new number.
const FULL_CONTENT_DEFAULT_LIMIT = 8000

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
  const limit = args.limit ?? FULL_CONTENT_DEFAULT_LIMIT
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
      limit: z.number().int().positive().optional(),
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
