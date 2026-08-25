import { NextRequest, NextResponse } from "next/server"
import { getVaultForRequest } from "@/lib/vault/server"
import { vaultErrorResponse } from "@/lib/vault/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const { scope } = await getVaultForRequest(req)
    return NextResponse.json({
      user_id: scope.userId,
      auth_method: scope.enforce === "explicit" ? "api_key" : "session",
    })
  } catch (err) {
    return vaultErrorResponse(err)
  }
}
