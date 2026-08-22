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
import type { DocumentFilter, GetDocumentOptions, Page, SearchOptions, VaultDocument, VaultProject, VaultRelatedDocument, VaultScope, VaultSearchResult, VaultStats } from "./types"
import { toVaultDocument, toVaultProject, toVaultRelatedDocument, toVaultSearchResult, toVaultStats, type ConversionRow, type ProjectRow, type RelatedDocumentRow, type SearchRow, type StatsRow } from "./mappers"
import { clampLimit, clampOffset, buildPage, escapeIlikeTerm } from "./query"
import { VaultError } from "./errors"

const LIST_COLUMNS =
  "id, filename, title, file_type, word_count, project_id, tags, source_type, converted_at, updated_at, version"
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

export interface VaultRepo {
  listDocuments(filter?: DocumentFilter): Promise<Page<VaultDocument>>
  getDocument(id: string, opts?: GetDocumentOptions): Promise<VaultDocument | null>
  listProjects(): Promise<VaultProject[]>
  getProject(id: string): Promise<VaultProject | null>
  getRelatedDocuments(documentId: string, maxResults?: number): Promise<VaultRelatedDocument[]>
  getStats(): Promise<VaultStats>
  searchDocuments(query: string, opts?: SearchOptions): Promise<Page<VaultSearchResult>>
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
      if (error) throw new VaultError("DB_ERROR", error.message)

      const rows = (data ?? []) as ConversionRow[]
      return buildPage(rows.map(toVaultDocument), { limit, offset, total: count ?? rows.length })
    },

    async getDocument(id: string, opts: GetDocumentOptions = {}): Promise<VaultDocument | null> {
      const columns = opts.includeMarkdown ? DETAIL_COLUMNS : LIST_COLUMNS
      const { data, error } = await scoped(client.from("conversions").select(columns), scope)
        .eq("id", id)
        .eq("in_vault", true)
        .maybeSingle()
      if (error) throw new VaultError("DB_ERROR", error.message)
      return data ? toVaultDocument(data as ConversionRow) : null
    },

    async listProjects(): Promise<VaultProject[]> {
      const { data, error } = await scoped(
        client.from("projects").select("id, name, color, created_at"),
        scope
      ).order("created_at", { ascending: true })
      if (error) throw new VaultError("DB_ERROR", error.message)
      return ((data ?? []) as ProjectRow[]).map(toVaultProject)
    },

    async getProject(id: string): Promise<VaultProject | null> {
      const { data, error } = await scoped(
        client.from("projects").select("id, name, color, created_at"),
        scope
      )
        .eq("id", id)
        .maybeSingle()
      if (error) throw new VaultError("DB_ERROR", error.message)
      return data ? toVaultProject(data as ProjectRow) : null
    },

    async getRelatedDocuments(documentId: string, maxResults = 10): Promise<VaultRelatedDocument[]> {
      const { data, error } = await client.rpc("find_related_documents", {
        p_user_id: scope.userId,
        p_source_id: documentId,
        p_max_results: maxResults,
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
      const { data, error } = await client.rpc("vault_search_documents", {
        p_user_id: scope.userId,
        p_query: query,
        p_project_id: opts.projectId ?? null,
        p_tags: opts.tags ?? null,
        p_limit: limit,
        p_offset: offset,
      })
      if (error) throw new VaultError("DB_ERROR", error.message)
      const rows = (data ?? []) as SearchRow[]
      const total = rows[0]?.total_count ?? 0
      return buildPage(rows.map(toVaultSearchResult), { limit, offset, total })
    },
  }
}

/** Browser-side convenience: anon client (RLS enforces), given the already-known
 *  signed-in user's id. Client-importable — no server-only imports anywhere in this
 *  file's dependency graph. */
export function browserVault(userId: string): VaultRepo {
  return createVaultRepo(createBrowserClient(), { enforce: "rls", userId })
}
