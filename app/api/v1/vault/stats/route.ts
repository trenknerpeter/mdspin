import { NextRequest, NextResponse } from "next/server"
import { getVaultForRequest } from "@/lib/vault/server"
import { vaultErrorResponse } from "@/lib/vault/http"
import { statsToJson } from "@/lib/vault/rest"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const { repo } = await getVaultForRequest(req)
    const stats = await repo.getStats()
    return NextResponse.json(statsToJson(stats))
  } catch (err) {
    return vaultErrorResponse(err)
  }
}
