import { NextRequest, NextResponse } from "next/server"
import { getVaultForRequest } from "@/lib/vault/server"
import { vaultErrorResponse } from "@/lib/vault/http"
import { sourceConnectionToJson } from "@/lib/vault/rest"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const { repo } = await getVaultForRequest(req)
    const connections = await repo.listSourceConnections()
    return NextResponse.json({ data: connections.map(sourceConnectionToJson) })
  } catch (err) {
    return vaultErrorResponse(err)
  }
}
