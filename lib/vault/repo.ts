// The shared vault data-access layer. This is the ONLY file that imports supabase-js
// (aside from the browser/server client factories it's handed) — every read and write
// the browser, REST routes, and MCP tools eventually make funnels through here, so a bug
// fixed once is fixed everywhere, and a security check added once applies everywhere.
//
// See lib/vault/auth.ts for how a request becomes a VaultScope, and the Cloud Knowledge
// Hub strategy doc's "shared repo core, injected client" decision for why this exists
// instead of a second server-side reimplementation of lib/library.ts.

import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient as createBrowserClient } from "@/lib/supabase/client"
import type { CursorPage, DocumentCursor, DocumentFilter, GetDocumentOptions, Page, SearchOptions, UpdateDocumentOptions, VaultDocument, VaultDocumentPatch, VaultProject, VaultRelatedDocument, VaultScope, VaultSearchResult, VaultStats } from "./types"
import type { AppendToDocumentOptions, CreateDocumentInput, CreateProjectInput, OrganizeDocumentOptions, ProjectPatch } from "./types"
import { buildDocumentPatchPayload, buildProjectPatchPayload, projectIdsFromColumn, toVaultDocument, toVaultProject, toVaultRelatedDocument, toVaultSearchResult, toVaultStats, type ConversionRow, type ProjectRow, type RelatedDocumentRow, type SearchRow, type StatsRow } from "./mappers"
import { clampLimit, clampOffset, buildPage, escapeIlikeTerm, isValidUuid, isValidTimestamp } from "./query"
import { VaultError } from "./errors"
import { embedQueryOrNull } from "./embeddings"
import { deriveFilenameFromTitle, deriveTitle } from "./title"
import { countWords } from "./text"

const LIST_COLUMNS =
  "id, filename, title, file_type, word_count, project_id, tags, source_type, converted_at, updated_at, version, summary, summary_status"
const DETAIL_COLUMNS = `${LIST_COLUMNS}, markdown_text`

/**
 * The single choke-point every scoped query passes through: it appends
 * `.eq("user_id", scope.userId)` no matter which VaultScope variant is in play.
 *
 * This is deliberately NOT conditional on `scope.enforce`. Under "rls" the database is
 * already filtering by `auth.uid()`, so this looks redundant — but that's the point:
 * a client swapped for the wrong one by a future bug, or an RLS policy accidentally
 * dropped in a migration, still can't leak another user's rows, because this repo never
 * relies on RLS being the ONLY thing standing guard. Under "explicit" (service role,
 * RLS bypassed) this filter is the entire security boundary.
 *
 * Typed loosely (not generic over supabase-js's builder type) on purpose: constraining a
 * generic T to "an .eq() that returns T" forces the compiler to reconcile that against
 * PostgrestFilterBuilder's real, deeply recursive generic instantiation and blows past
 * TS's recursion limit (`TS2589: Type instantiation is excessively deep`). The rest of
 * this codebase already casts supabase query results to domain types at the boundary
 * (see lib/library.ts's `as RelatedSpin[]`) rather than threading supabase-js's own
 * generics through; this keeps the same idiom at the one seam that needs it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scoped(builder: any, scope: VaultScope): any {
  return builder.eq("user_id", scope.userId)
}

/**
 * Batched project-membership lookup for a page of documents at once — never call this
 * once per row. Returns ids ordered earliest-linked-first per document, matching the
 * "primary project" convention Phase A's SQL (find_related_documents,
 * vault_search_documents) already uses, so a caller that only wants "the" project for
 * display can just take index 0.
 */
async function fetchProjectIdsByDocument(
  client: SupabaseClient,
  scope: VaultScope,
  documentIds: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  if (documentIds.length === 0) return map

  const { data, error } = await scoped(
    client.from("document_projects").select("document_id, project_id, added_at"),
    scope
  )
    .in("document_id", documentIds)
    .order("added_at", { ascending: true })
    .order("project_id", { ascending: true })
  if (error) throw new VaultError("DB_ERROR", error.message)

  for (const r of (data ?? []) as { document_id: string; project_id: string }[]) {
    const existing = map.get(r.document_id)
    if (existing) existing.push(r.project_id)
    else map.set(r.document_id, [r.project_id])
  }
  return map
}

export interface VaultRepo {
  listDocuments(filter?: DocumentFilter): Promise<Page<VaultDocument>>
  getDocument(id: string, opts?: GetDocumentOptions): Promise<VaultDocument | null>
  listProjects(): Promise<VaultProject[]>
  getProject(id: string): Promise<VaultProject | null>
  createProject(input: CreateProjectInput): Promise<VaultProject>
  updateProject(id: string, patch: ProjectPatch): Promise<VaultProject>
  getRelatedDocuments(documentId: string, maxResults?: number): Promise<VaultRelatedDocument[]>
  getStats(): Promise<VaultStats>
  searchDocuments(query: string, opts?: SearchOptions): Promise<Page<VaultSearchResult>>
  updateDocument(id: string, patch: VaultDocumentPatch, opts: UpdateDocumentOptions): Promise<VaultDocument>
  createDocument(input: CreateDocumentInput): Promise<VaultDocument>
  appendToDocument(id: string, addition: string, opts?: AppendToDocumentOptions): Promise<VaultDocument>
  organizeDocument(id: string, opts: OrganizeDocumentOptions): Promise<VaultDocument>
  removeFromVault(id: string): Promise<void>
  listDocumentsByCursor(filter?: {
    projectId?: string
    tags?: string[]
    limit?: number
    cursor?: DocumentCursor
  }): Promise<CursorPage<VaultDocument>>
}

/**
 * Build a VaultRepo bound to one client and one scope.
 *
 * Throws at construction, not on first call, if `scope.userId` is falsy — per the
 * VaultScope discriminated union, every variant is SUPPOSED to carry one, so an empty
 * string here means a caller upstream (most likely auth.ts) has a bug, and failing at
 * construction surfaces it at the call site that made the mistake rather than three
 * methods later inside whichever one happened to run first.
 */
export function createVaultRepo(client: SupabaseClient, scope: VaultScope): VaultRepo {
  if (!scope.userId) {
    throw new VaultError("AUTH_REQUIRED", "VaultScope requires a userId.")
  }

  return {
    async listDocuments(filter: DocumentFilter = {}): Promise<Page<VaultDocument>> {
      const limit = clampLimit(filter.limit)
      const offset = clampOffset(filter.offset)

      // NOTE for Stage 2e: list_documents over MCP needs a keyset cursor on
      // (updated_at, id), not this offset scheme — offset pagination is where an agent
      // silently skips or duplicates rows across calls. Add a cursor-based sibling method
      // rather than changing this one; the REST envelope this returns is offset-shaped.
      let query = scoped(
        client.from("conversions").select(LIST_COLUMNS, { count: "exact" }),
        scope
      ).eq("in_vault", true)

      if (filter.projectId) query = query.eq("project_id", filter.projectId)
      if (filter.tags?.length) query = query.overlaps("tags", filter.tags)
      if (filter.search) {
        const term = `%${escapeIlikeTerm(filter.search)}%`
        query = query.or(`filename.ilike.${term},title.ilike.${term},markdown_text.ilike.${term}`)
      }

      const { data, error, count } = await query
        .order("updated_at", { ascending: false })
        .range(offset, offset + limit - 1)
      // PGRST103 = "Requested range not satisfiable": PostgREST errors instead of returning
      // an empty body when `offset` overshoots the total row count. That's a normal thing for
      // a paging client to do (walk one page past the end), not a server fault, and the
      // sibling searchDocuments() already answers it with a clean empty page because its RPC
      // just returns 0 rows. Mirror that here rather than turning it into a 500.
      if (error?.code === "PGRST103") {
        return buildPage([], { limit, offset, total: count ?? 0 })
      }
      if (error) throw new VaultError("DB_ERROR", error.message)

      const rows = (data ?? []) as ConversionRow[]
      const projectIdsByDoc = await fetchProjectIdsByDocument(client, scope, rows.map((r) => r.id))
      return buildPage(
        rows.map((r) => toVaultDocument(r, projectIdsByDoc.get(r.id) ?? [])),
        { limit, offset, total: count ?? rows.length }
      )
    },

    async getDocument(id: string, opts: GetDocumentOptions = {}): Promise<VaultDocument | null> {
      const columns = opts.includeMarkdown ? DETAIL_COLUMNS : LIST_COLUMNS
      const { data, error } = await scoped(client.from("conversions").select(columns), scope)
        .eq("id", id)
        .eq("in_vault", true)
        .maybeSingle()
      if (error) throw new VaultError("DB_ERROR", error.message)
      if (!data) return null
      const row = data as ConversionRow
      const projectIdsByDoc = await fetchProjectIdsByDocument(client, scope, [row.id])
      return toVaultDocument(row, projectIdsByDoc.get(row.id) ?? [])
    },

    async listProjects(): Promise<VaultProject[]> {
      const { data, error } = await scoped(
        client.from("projects").select("id, name, color, created_at, instructions"),
        scope
      ).order("created_at", { ascending: true })
      if (error) throw new VaultError("DB_ERROR", error.message)
      return ((data ?? []) as ProjectRow[]).map(toVaultProject)
    },

    async getProject(id: string): Promise<VaultProject | null> {
      const { data, error } = await scoped(
        client.from("projects").select("id, name, color, created_at, instructions"),
        scope
      )
        .eq("id", id)
        .maybeSingle()
      if (error) throw new VaultError("DB_ERROR", error.message)
      return data ? toVaultProject(data as ProjectRow) : null
    },

    async createProject(input: CreateProjectInput): Promise<VaultProject> {
      const { data, error } = await client
        .from("projects")
        .insert({
          user_id: scope.userId,
          name: input.name,
          color: input.color ?? null,
          instructions: input.instructions ?? null,
        })
        .select("id, name, color, created_at, instructions")
        .single()
      if (error) throw new VaultError("DB_ERROR", error.message)
      return toVaultProject(data as ProjectRow)
    },

    async updateProject(id: string, patch: ProjectPatch): Promise<VaultProject> {
      const payload = buildProjectPatchPayload(patch)
      if (Object.keys(payload).length === 0) {
        throw new VaultError("INVALID_REQUEST", "Patch must include at least one field to update.")
      }
      const { data, error } = await scoped(
        client.from("projects").update(payload),
        scope
      )
        .eq("id", id)
        .select("id, name, color, created_at, instructions")
        .maybeSingle()
      if (error) throw new VaultError("DB_ERROR", error.message)
      if (!data) throw new VaultError("NOT_FOUND", "Project not found.")
      return toVaultProject(data as ProjectRow)
    },

    async getRelatedDocuments(documentId: string, maxResults = 10): Promise<VaultRelatedDocument[]> {
      const { data, error } = await client.rpc("find_related_documents", {
        p_user_id: scope.userId,
        p_source_id: documentId,
        // Clamp: -1 (or any out-of-range value) previously reached Postgres raw and blew up
        // with a 2201W. 25 matches the strategy doc's stated MCP tool limit for
        // related-document lookups. `maxResults` already defaults to 10 above, so a caller
        // passing nothing still gets 10 — clampLimit's own internal default (used only when
        // its first arg is `undefined`) never comes into play here.
        p_max_results: clampLimit(maxResults, 25),
      })
      if (error) throw new VaultError("DB_ERROR", error.message)
      return ((data ?? []) as RelatedDocumentRow[]).map(toVaultRelatedDocument)
    },

    async getStats(): Promise<VaultStats> {
      const { data, error } = await client.rpc("vault_stats", { p_user_id: scope.userId })
      if (error) throw new VaultError("DB_ERROR", error.message)
      const rows = (data ?? []) as StatsRow[]
      return toVaultStats(rows[0] ?? { document_count: 0, project_count: 0, top_tags: [] })
    },

    async searchDocuments(query: string, opts: SearchOptions = {}): Promise<Page<VaultSearchResult>> {
      const limit = clampLimit(opts.limit)
      const offset = clampOffset(opts.offset)
      const queryEmbedding = await embedQueryOrNull(query)
      const { data, error } = await client.rpc("vault_search_documents", {
        p_user_id: scope.userId,
        p_query: query,
        // Match listDocuments()'s truthiness convention rather than `?? null`: an empty
        // string projectId or an empty tags array must normalize to "no filter" (null), not
        // be forwarded as-is — `{tags: []}` && anything is never true (0 rows), and an empty
        // string cast to uuid throws a Postgres 22P02 that would otherwise surface as a 500.
        p_project_id: opts.projectId || null,
        p_tags: opts.tags?.length ? opts.tags : null,
        p_limit: limit,
        p_offset: offset,
        p_query_embedding: queryEmbedding,
      })
      if (error) throw new VaultError("DB_ERROR", error.message)
      const rows = (data ?? []) as SearchRow[]
      const total = rows[0]?.total_count ?? 0
      const projectIdsByDoc = await fetchProjectIdsByDocument(client, scope, rows.map((r) => r.id))
      return buildPage(
        rows.map((r) => toVaultSearchResult(r, projectIdsByDoc.get(r.id) ?? [])),
        { limit, offset, total }
      )
    },

    async updateDocument(
      id: string,
      patch: VaultDocumentPatch,
      opts: UpdateDocumentOptions
    ): Promise<VaultDocument> {
      const payload = buildDocumentPatchPayload(patch)
      // An empty payload (no recognized keys) is a destructive no-op at the SQL layer: the
      // UPDATE still runs, the conversions_touch trigger still bumps version, and a junk
      // pre-image revision row still gets written — for a patch that changed nothing. Reject
      // before ever calling the RPC.
      if (Object.keys(payload).length === 0) {
        throw new VaultError("INVALID_REQUEST", "Patch must include at least one field to update.")
      }
      const { data, error } = await client.rpc("vault_update_document", {
        p_user_id: scope.userId,
        p_document_id: id,
        p_expected_version: opts.expectedVersion,
        p_patch: payload,
        p_actor: opts.actor ?? "user",
        p_actor_key_id: opts.actorKeyId ?? null,
        p_reason: opts.reason ?? null,
        p_confirm_shrink: opts.confirmShrink ?? false,
      })
      if (error) {
        if (error.code === "55000") {
          throw new VaultError(
            "VERSION_CONFLICT",
            `Expected version ${opts.expectedVersion}, current is ${error.details}.`
          )
        }
        if (error.code === "P0002") throw new VaultError("NOT_FOUND", "Document not found.")
        if (error.code === "28000") throw new VaultError("AUTH_REQUIRED", "Not authorized for this document.")
        if (error.code === "22023") throw new VaultError("INVALID_REQUEST", "project_id does not belong to this user.")
        if (error.code === "0A000") {
          throw new VaultError(
            "IMMUTABLE_SOURCE",
            "This document's source is immutable; use append_to_document instead."
          )
        }
        if (error.code === "22001") {
          let prev: number | undefined
          let next: number | undefined
          try {
            const parsed = JSON.parse(error.details ?? "{}")
            prev = parsed.previous_length
            next = parsed.new_length
          } catch {
            // error.details wasn't the JSON we expect — fall through with prev/next undefined.
          }
          throw new VaultError(
            "SUSPICIOUS_SHRINK",
            `New content (${next ?? "?"} chars) is less than half the previous (${prev ?? "?"} chars). Pass confirm_shrink to override.`
          )
        }
        throw new VaultError("DB_ERROR", error.message)
      }
      const rows = (data ?? []) as ConversionRow[]
      if (!rows[0]) throw new VaultError("NOT_FOUND", "Document not found.")
      return toVaultDocument(rows[0], projectIdsFromColumn(rows[0]))
    },

    async createDocument(input: CreateDocumentInput): Promise<VaultDocument> {
      if (input.projectId) {
        const { data: proj, error: projErr } = await scoped(
          client.from("projects").select("id"),
          scope
        ).eq("id", input.projectId).maybeSingle()
        if (projErr) throw new VaultError("DB_ERROR", projErr.message)
        if (!proj) throw new VaultError("INVALID_REQUEST", "project_id does not belong to this user.")
      }

      const title = input.title?.trim() || deriveTitle({ body: input.markdown, filename: null })
      const filename = deriveFilenameFromTitle(title)

      const { data, error } = await client
        .from("conversions")
        .insert({
          user_id: scope.userId,
          filename,
          file_type: "md",
          title,
          markdown_text: input.markdown,
          word_count: countWords(input.markdown),
          tags: input.tags ?? [],
          project_id: input.projectId ?? null,
          in_vault: true,
          source_type: "mcp",
        })
        .select(DETAIL_COLUMNS)
        .single()
      if (error) throw new VaultError("DB_ERROR", error.message)
      const row = data as ConversionRow
      return toVaultDocument(row, projectIdsFromColumn(row))
    },

    async appendToDocument(
      id: string,
      addition: string,
      opts: AppendToDocumentOptions = {}
    ): Promise<VaultDocument> {
      if (!addition.trim()) {
        throw new VaultError("INVALID_REQUEST", "addition must not be empty.")
      }
      const { data, error } = await client.rpc("vault_append_to_document", {
        p_user_id: scope.userId,
        p_document_id: id,
        p_addition: addition,
        p_actor: opts.actor ?? "mcp",
        p_actor_key_id: opts.actorKeyId ?? null,
        p_reason: opts.reason ?? null,
      })
      if (error) {
        if (error.code === "P0002") throw new VaultError("NOT_FOUND", "Document not found.")
        if (error.code === "28000") throw new VaultError("AUTH_REQUIRED", "Not authorized for this document.")
        throw new VaultError("DB_ERROR", error.message)
      }
      const rows = (data ?? []) as ConversionRow[]
      if (!rows[0]) throw new VaultError("NOT_FOUND", "Document not found.")
      return toVaultDocument(rows[0], projectIdsFromColumn(rows[0]))
    },

    async organizeDocument(id: string, opts: OrganizeDocumentOptions): Promise<VaultDocument> {
      const addTags = opts.addTags ?? []
      const removeTags = opts.removeTags ?? []
      if (addTags.length === 0 && removeTags.length === 0) {
        throw new VaultError("INVALID_REQUEST", "Provide at least one tag to add or remove.")
      }
      const { data, error } = await client.rpc("vault_organize_document", {
        p_user_id: scope.userId,
        p_document_id: id,
        p_add_tags: addTags,
        p_remove_tags: removeTags,
        p_actor: opts.actor ?? "mcp",
        p_actor_key_id: opts.actorKeyId ?? null,
        p_reason: opts.reason ?? null,
      })
      if (error) {
        if (error.code === "P0002") throw new VaultError("NOT_FOUND", "Document not found.")
        if (error.code === "28000") throw new VaultError("AUTH_REQUIRED", "Not authorized for this document.")
        throw new VaultError("DB_ERROR", error.message)
      }
      const rows = (data ?? []) as ConversionRow[]
      if (!rows[0]) throw new VaultError("NOT_FOUND", "Document not found.")
      return toVaultDocument(rows[0], projectIdsFromColumn(rows[0]))
    },

    async removeFromVault(id: string): Promise<void> {
      const { data, error } = await scoped(
        client.from("conversions").update({ in_vault: false }),
        scope
      )
        .eq("id", id)
        .select("id")
        .maybeSingle()
      if (error) throw new VaultError("DB_ERROR", error.message)
      if (!data) throw new VaultError("NOT_FOUND", "Document not found.")
    },

    async listDocumentsByCursor(
      filter: { projectId?: string; tags?: string[]; limit?: number; cursor?: DocumentCursor } = {}
    ): Promise<CursorPage<VaultDocument>> {
      // Validate BEFORE touching the client at all — a malformed cursor must never reach
      // the .or() string-interpolation below, and must never even construct a query
      // builder (see the "rejects... before building any query" tests).
      if (filter.cursor && (!isValidTimestamp(filter.cursor.updatedAt) || !isValidUuid(filter.cursor.id))) {
        throw new VaultError("INVALID_REQUEST", "Invalid cursor.")
      }

      const limit = clampLimit(filter.limit, 25)

      let query = scoped(
        client.from("conversions").select(LIST_COLUMNS),
        scope
      ).eq("in_vault", true)

      if (filter.projectId) query = query.eq("project_id", filter.projectId)
      if (filter.tags?.length) query = query.overlaps("tags", filter.tags)
      if (filter.cursor) {
        const { updatedAt, id } = filter.cursor
        query = query.or(`updated_at.lt.${updatedAt},and(updated_at.eq.${updatedAt},id.lt.${id})`)
      }

      const { data, error } = await query
        .order("updated_at", { ascending: false })
        .order("id", { ascending: false })
        .range(0, limit - 1)
      if (error) throw new VaultError("DB_ERROR", error.message)

      const rows = (data ?? []) as ConversionRow[]
      const projectIdsByDoc = await fetchProjectIdsByDocument(client, scope, rows.map((r) => r.id))
      const docs = rows.map((r) => toVaultDocument(r, projectIdsByDoc.get(r.id) ?? []))
      const last = rows[rows.length - 1]
      const nextCursor: DocumentCursor | null =
        rows.length === limit && last ? { updatedAt: last.updated_at, id: last.id } : null

      return { data: docs, nextCursor }
    },
  }
}

/** Browser-side convenience: anon client (RLS enforces), given the already-known
 *  signed-in user's id. Client-importable — no server-only imports anywhere in this
 *  file's dependency graph. */
export function browserVault(userId: string): VaultRepo {
  return createVaultRepo(createBrowserClient(), { enforce: "rls", userId })
}
