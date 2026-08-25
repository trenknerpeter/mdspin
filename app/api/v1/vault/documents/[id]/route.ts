import { NextRequest, NextResponse } from "next/server"
import { getVaultForRequest } from "@/lib/vault/server"
import { vaultErrorResponse } from "@/lib/vault/http"
import { documentToJson } from "@/lib/vault/rest"
import { VaultError } from "@/lib/vault/errors"
import type { VaultDocumentPatch } from "@/lib/vault/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { repo } = await getVaultForRequest(req)
    const { id } = await params
    const includeMarkdown = req.nextUrl.searchParams.get("include") === "markdown"
    const doc = await repo.getDocument(id, { includeMarkdown })
    if (!doc) throw new VaultError("NOT_FOUND", "Document not found.")
    return NextResponse.json(documentToJson(doc))
  } catch (err) {
    return vaultErrorResponse(err)
  }
}

interface PatchBody {
  title?: string | null
  markdown_text?: string | null
  tags?: string[]
  project_id?: string | null
  expected_version?: number
  reason?: string
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { repo, scope, keyId } = await getVaultForRequest(req)
    const { id } = await params

    let body: PatchBody
    try {
      body = await req.json()
    } catch {
      throw new VaultError("INVALID_REQUEST", "Body must be JSON.")
    }
    if (typeof body.expected_version !== "number") {
      throw new VaultError("INVALID_REQUEST", "expected_version is required and must be a number.")
    }

    const patch: VaultDocumentPatch = {}
    if ("title" in body) patch.title = body.title ?? null
    if ("markdown_text" in body) patch.markdown = body.markdown_text ?? null
    if ("tags" in body) patch.tags = body.tags
    if ("project_id" in body) patch.projectId = body.project_id ?? null

    const doc = await repo.updateDocument(id, patch, {
      expectedVersion: body.expected_version,
      actor: scope.enforce === "explicit" ? "api" : "user",
      actorKeyId: keyId,
      reason: body.reason,
    })
    return NextResponse.json(documentToJson(doc))
  } catch (err) {
    return vaultErrorResponse(err)
  }
}
