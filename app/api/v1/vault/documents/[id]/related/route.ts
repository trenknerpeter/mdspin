import { NextRequest, NextResponse } from "next/server"
import { getVaultForRequest } from "@/lib/vault/server"
import { vaultErrorResponse } from "@/lib/vault/http"
import { relatedDocumentToJson } from "@/lib/vault/rest"
import { parseNumberParam, isValidUuid } from "@/lib/vault/query"
import { VaultError } from "@/lib/vault/errors"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { repo } = await getVaultForRequest(req)
    const { id } = await params
    if (!isValidUuid(id)) throw new VaultError("INVALID_REQUEST", "id must be a valid UUID.")
    const limit = parseNumberParam(req.nextUrl.searchParams.get("limit"))
    const related = await repo.getRelatedDocuments(id, limit)
    return NextResponse.json({ data: related.map(relatedDocumentToJson) })
  } catch (err) {
    return vaultErrorResponse(err)
  }
}
