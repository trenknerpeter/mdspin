import { NextRequest, NextResponse } from "next/server"
import { getVaultForRequest } from "@/lib/vault/server"
import { vaultErrorResponse } from "@/lib/vault/http"
import { projectToJson } from "@/lib/vault/rest"
import { VaultError } from "@/lib/vault/errors"
import { isValidUuid } from "@/lib/vault/query"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { repo } = await getVaultForRequest(req)
    const { id } = await params
    if (!isValidUuid(id)) throw new VaultError("INVALID_REQUEST", "id must be a valid UUID.")
    const project = await repo.getProject(id)
    if (!project) throw new VaultError("NOT_FOUND", "Project not found.")
    return NextResponse.json(projectToJson(project))
  } catch (err) {
    return vaultErrorResponse(err)
  }
}
