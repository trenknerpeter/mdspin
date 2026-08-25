import { NextRequest, NextResponse } from "next/server"
import { getVaultForRequest } from "@/lib/vault/server"
import { vaultErrorResponse } from "@/lib/vault/http"
import { projectToJson } from "@/lib/vault/rest"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const { repo } = await getVaultForRequest(req)
    const projects = await repo.listProjects()
    return NextResponse.json({ data: projects.map(projectToJson) })
  } catch (err) {
    return vaultErrorResponse(err)
  }
}
