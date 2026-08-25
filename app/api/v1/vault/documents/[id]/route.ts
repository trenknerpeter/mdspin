import { NextRequest, NextResponse } from "next/server"
import { getVaultForRequest } from "@/lib/vault/server"
import { vaultErrorResponse } from "@/lib/vault/http"
import { documentToJson } from "@/lib/vault/rest"
import { VaultError } from "@/lib/vault/errors"
import { isValidUuid } from "@/lib/vault/query"
import type { VaultDocumentPatch } from "@/lib/vault/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { repo } = await getVaultForRequest(req)
    const { id } = await params
    if (!isValidUuid(id)) throw new VaultError("INVALID_REQUEST", "id must be a valid UUID.")
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
    if (!isValidUuid(id)) throw new VaultError("INVALID_REQUEST", "id must be a valid UUID.")

    let raw: unknown
    try {
      raw = await req.json()
    } catch {
      throw new VaultError("INVALID_REQUEST", "Body must be JSON.")
    }
    // `typeof null === "object"`, so a literal `null` body needs its own check: without it
    // the `body.expected_version` read below throws a bare TypeError that escapes this
    // handler as an opaque 500 INTERNAL_ERROR instead of the 400 it plainly is.
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      throw new VaultError("INVALID_REQUEST", "Body must be a JSON object.")
    }
    const body = raw as PatchBody

    if (typeof body.expected_version !== "number") {
      throw new VaultError("INVALID_REQUEST", "expected_version is required and must be a number.")
    }

    // Type-check each patchable field HERE rather than letting Postgres decide. The RPC
    // raises SQLSTATE 22023 for several unrelated problems — a project_id the caller doesn't
    // own, but also `jsonb_array_elements_text` being handed a non-array `tags` — and the
    // repo can only map that one code to a single message. So a malformed `tags` used to
    // come back blaming `project_id`: a real 400, pointed at the wrong field. These checks
    // catch the shape mistakes up front and name the field that's actually wrong; the repo's
    // 22023 mapping stays as the fallback for what's left (genuinely cross-tenant project_id).
    if ("title" in body && !(typeof body.title === "string" || body.title === null)) {
      throw new VaultError("INVALID_REQUEST", "title must be a string or null.")
    }
    if (
      "markdown_text" in body &&
      !(typeof body.markdown_text === "string" || body.markdown_text === null)
    ) {
      throw new VaultError("INVALID_REQUEST", "markdown_text must be a string or null.")
    }
    if ("tags" in body && !(Array.isArray(body.tags) && body.tags.every((t) => typeof t === "string"))) {
      throw new VaultError("INVALID_REQUEST", "tags must be an array of strings.")
    }
    if (
      "project_id" in body &&
      !(body.project_id === null || (typeof body.project_id === "string" && isValidUuid(body.project_id)))
    ) {
      throw new VaultError("INVALID_REQUEST", "project_id must be a valid UUID or null.")
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
