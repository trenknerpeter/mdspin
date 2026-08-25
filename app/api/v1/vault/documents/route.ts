import { NextRequest, NextResponse } from "next/server"
import { getVaultForRequest } from "@/lib/vault/server"
import { vaultErrorResponse } from "@/lib/vault/http"
import { pageToJson, documentToJson } from "@/lib/vault/rest"
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
