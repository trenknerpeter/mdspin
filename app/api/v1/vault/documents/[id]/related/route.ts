import { NextRequest, NextResponse } from "next/server"
import { getVaultForRequest } from "@/lib/vault/server"
import { vaultErrorResponse } from "@/lib/vault/http"
import { relatedDocumentToJson } from "@/lib/vault/rest"
import { parseNumberParam } from "@/lib/vault/query"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { repo } = await getVaultForRequest(req)
    const { id } = await params
    const limit = parseNumberParam(req.nextUrl.searchParams.get("limit"))
    const related = await repo.getRelatedDocuments(id, limit)
    return NextResponse.json({ data: related.map(relatedDocumentToJson) })
  } catch (err) {
    return vaultErrorResponse(err)
  }
}
