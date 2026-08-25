import { NextRequest, NextResponse } from "next/server"
import { getVaultForRequest } from "@/lib/vault/server"
import { vaultErrorResponse } from "@/lib/vault/http"
import { pageToJson, searchResultToJson } from "@/lib/vault/rest"
import { parseTagsParam, parseNumberParam } from "@/lib/vault/query"
import { VaultError } from "@/lib/vault/errors"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const { repo } = await getVaultForRequest(req)
    const sp = req.nextUrl.searchParams
    const query = sp.get("q")?.trim()
    if (!query) throw new VaultError("INVALID_REQUEST", "q is required.")
    const mode = sp.get("mode") ?? "keyword"
    if (mode !== "keyword") {
      throw new VaultError("INVALID_REQUEST", `Unsupported search mode "${mode}". Only "keyword" is available.`)
    }
    const page = await repo.searchDocuments(query, {
      projectId: sp.get("project_id") ?? undefined,
      tags: parseTagsParam(sp.get("tags")),
      limit: parseNumberParam(sp.get("limit")),
      offset: parseNumberParam(sp.get("offset")),
    })
    return NextResponse.json(pageToJson(page, searchResultToJson))
  } catch (err) {
    return vaultErrorResponse(err)
  }
}
