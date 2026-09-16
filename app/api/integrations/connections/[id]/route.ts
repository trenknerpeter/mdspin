import { NextRequest, NextResponse } from "next/server"
import { getVaultForRequest } from "@/lib/vault/server"
import { vaultErrorResponse } from "@/lib/vault/http"
import { sourceConnectionToJson } from "@/lib/vault/rest"
import { VaultError } from "@/lib/vault/errors"
import { isValidUuid } from "@/lib/vault/query"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { repo } = await getVaultForRequest(req)
    const { id } = await params
    if (!isValidUuid(id)) throw new VaultError("INVALID_REQUEST", "id must be a valid UUID.")

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") throw new VaultError("INVALID_REQUEST", "Body must be JSON.")
    const { status } = body as Record<string, unknown>
    if (status !== "active" && status !== "paused") {
      throw new VaultError("INVALID_REQUEST", "status must be 'active' or 'paused'.")
    }

    const updated = await repo.updateSourceConnection(id, { status })
    return NextResponse.json(sourceConnectionToJson(updated))
  } catch (err) {
    return vaultErrorResponse(err)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { repo } = await getVaultForRequest(req)
    const { id } = await params
    if (!isValidUuid(id)) throw new VaultError("INVALID_REQUEST", "id must be a valid UUID.")
    await repo.deleteSourceConnection(id)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return vaultErrorResponse(err)
  }
}
