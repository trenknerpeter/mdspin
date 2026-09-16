import { NextRequest, NextResponse } from "next/server"
import { getVaultForRequest } from "@/lib/vault/server"
import { vaultErrorResponse } from "@/lib/vault/http"
import { pageToJson, documentToJson, upsertSyncedDocumentToJson } from "@/lib/vault/rest"
import { parseTagsParam, parseNumberParam, isValidUuid } from "@/lib/vault/query"
import { VaultError } from "@/lib/vault/errors"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const { repo } = await getVaultForRequest(req)
    const sp = req.nextUrl.searchParams
    // `project_id` is an OPTIONAL filter, so only a value actually supplied has to be a
    // well-formed uuid. A missing param — and a bare `?project_id=` — both keep their
    // existing meaning of "no filter" (the repo and searchDocuments already normalize the
    // empty string that way); only a non-empty, malformed id is a client error worth a 400.
    const projectId = sp.get("project_id")?.trim() || undefined
    if (projectId !== undefined && !isValidUuid(projectId)) {
      throw new VaultError("INVALID_REQUEST", "project_id must be a valid UUID.")
    }
    const page = await repo.listDocuments({
      projectId,
      tags: parseTagsParam(sp.get("tags")),
      search: sp.get("search") ?? undefined,
      limit: parseNumberParam(sp.get("limit")),
      offset: parseNumberParam(sp.get("offset")),
    })
    return NextResponse.json(pageToJson(page, documentToJson))
  } catch (err) {
    return vaultErrorResponse(err)
  }
}

/**
 * Upsert-by-external-identity for a live source connection — Stage 1 of Live Source
 * Sync. This is scoped strictly to the sync use case (source_connection_id and
 * external_id are both required): it is NOT a general "create a document over REST"
 * endpoint, which doesn't otherwise exist and isn't needed here — create_document over
 * MCP already covers that. GitHub's own webhook handler calls
 * repo.upsertSyncedDocument() directly in-process (no self-HTTP-call); this route
 * exists so the same capability is reachable by an external caller authenticated with
 * an API key, e.g. a future Make module (Stage 2).
 */
export async function POST(req: NextRequest) {
  try {
    const { repo } = await getVaultForRequest(req)
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      throw new VaultError("INVALID_REQUEST", "Request body must be JSON.")
    }
    const { source_connection_id, external_id, external_url, title, markdown, project_id, tags, summary_status } =
      body as Record<string, unknown>

    if (typeof source_connection_id !== "string" || !isValidUuid(source_connection_id)) {
      throw new VaultError("INVALID_REQUEST", "source_connection_id must be a valid UUID.")
    }
    if (typeof external_id !== "string" || !external_id.trim()) {
      throw new VaultError("INVALID_REQUEST", "external_id is required.")
    }
    if (typeof markdown !== "string") {
      throw new VaultError("INVALID_REQUEST", "markdown is required.")
    }
    if (summary_status !== undefined && summary_status !== "pending" && summary_status !== "manual") {
      throw new VaultError("INVALID_REQUEST", "summary_status must be 'pending' or 'manual'.")
    }

    const result = await repo.upsertSyncedDocument({
      connectionId: source_connection_id,
      externalId: external_id,
      externalUrl: typeof external_url === "string" ? external_url : null,
      title: typeof title === "string" ? title : null,
      markdown,
      projectId: typeof project_id === "string" && isValidUuid(project_id) ? project_id : null,
      tags: Array.isArray(tags) ? tags.filter((t): t is string => typeof t === "string") : undefined,
      summaryStatus: summary_status as "pending" | "manual" | undefined,
    })

    return NextResponse.json(upsertSyncedDocumentToJson(result), {
      status: result.action === "inserted" || result.action === "adopted" ? 201 : 200,
    })
  } catch (err) {
    return vaultErrorResponse(err)
  }
}
