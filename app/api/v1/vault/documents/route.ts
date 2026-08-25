import { NextRequest, NextResponse } from "next/server"
import { getVaultForRequest } from "@/lib/vault/server"
import { vaultErrorResponse } from "@/lib/vault/http"
import { pageToJson, documentToJson } from "@/lib/vault/rest"
import { parseTagsParam, parseNumberParam } from "@/lib/vault/query"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const { repo } = await getVaultForRequest(req)
    const sp = req.nextUrl.searchParams
    const page = await repo.listDocuments({
      projectId: sp.get("project_id") ?? undefined,
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
