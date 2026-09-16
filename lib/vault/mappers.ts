// Pure row -> domain mapping. Isolated from repo.ts so the DB's column-naming
// conventions (snake_case, singular `project_id`) never leak past this one seam.

import type { ProjectPatch, VaultDocument, VaultDocumentPatch, VaultProject, VaultRelatedDocument, VaultSearchResult, VaultStats, SourceConnection, SourceConnectionPatch, SourceLinkState, UpsertSyncedDocumentAction, UpsertSyncedDocumentResult } from "./types"

/** Shape of a `conversions` row as selected by repo.ts. `markdown_text` is absent from
 *  the row entirely on list queries (repo.ts omits the column — one doc is 2.4MB) and
 *  present on detail queries that asked for it; `toVaultDocument`'s `?? null` collapses
 *  both "column omitted" and "column selected but empty" to the same `null`. */
export interface ConversionRow {
  id: string
  filename: string
  title: string | null
  file_type: string
  word_count: number | null
  project_id: string | null
  tags: string[] | null
  source_type: string
  converted_at: string
  updated_at: string
  version: number
  markdown_text?: string | null
  summary?: string | null
  summary_status?: string
}

export interface ProjectRow {
  id: string
  name: string
  color: string | null
  created_at: string
  instructions?: string | null
  parent_id?: string | null
}

export function toVaultDocument(row: ConversionRow, projectIds: string[]): VaultDocument {
  return {
    id: row.id,
    filename: row.filename,
    title: row.title,
    fileType: row.file_type,
    wordCount: row.word_count,
    projectIds,
    tags: row.tags ?? [],
    sourceType: row.source_type,
    convertedAt: row.converted_at,
    updatedAt: row.updated_at,
    version: row.version,
    markdown: row.markdown_text ?? null,
    summary: row.summary ?? null,
    summaryStatus: row.summary_status ?? "pending",
  }
}

/** For call sites that just wrote/returned a single-project row and know no second link
 *  can exist yet (multi-project write isn't exposed) — derives projectIds without a
 *  document_projects round trip. See Stage 5 Phase B's Global Constraints. */
export function projectIdsFromColumn(row: Pick<ConversionRow, "project_id">): string[] {
  return row.project_id ? [row.project_id] : []
}

export function toVaultProject(row: ProjectRow): VaultProject {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
    instructions: row.instructions ?? null,
    parentId: row.parent_id ?? null,
  }
}

export interface RelatedDocumentRow {
  id: string
  filename: string
  title: string | null
  file_type: string
  word_count: number | null
  tags: string[] | null
  project_id: string | null
  converted_at: string
  rank: number
  strength: string
}

export function toVaultRelatedDocument(row: RelatedDocumentRow): VaultRelatedDocument {
  return {
    id: row.id,
    filename: row.filename,
    title: row.title,
    fileType: row.file_type,
    wordCount: row.word_count,
    tags: row.tags ?? [],
    projectId: row.project_id,
    convertedAt: row.converted_at,
    rank: row.rank,
    strength: row.strength as VaultRelatedDocument["strength"],
  }
}

export interface StatsRow {
  document_count: number
  project_count: number
  top_tags: Array<{ tag: string; count: number }> | null
}

export function toVaultStats(row: StatsRow): VaultStats {
  return {
    documentCount: row.document_count,
    projectCount: row.project_count,
    topTags: row.top_tags ?? [],
  }
}

export interface SearchRow extends ConversionRow {
  rank: number
  snippet: string
  total_count: number
}

export function toVaultSearchResult(row: SearchRow, projectIds: string[]): VaultSearchResult {
  return { ...toVaultDocument(row, projectIds), rank: row.rank, snippet: row.snippet }
}

export function buildDocumentPatchPayload(patch: VaultDocumentPatch): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  if ("title" in patch) payload.title = patch.title
  if ("markdown" in patch) payload.markdown_text = patch.markdown
  if ("tags" in patch) payload.tags = patch.tags
  if ("projectId" in patch) payload.project_id = patch.projectId
  return payload
}

export function buildProjectPatchPayload(patch: ProjectPatch): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  if ("name" in patch) payload.name = patch.name
  if ("color" in patch) payload.color = patch.color
  if ("instructions" in patch) payload.instructions = patch.instructions
  if ("parentId" in patch) payload.parent_id = patch.parentId
  return payload
}

export interface SourceConnectionRow {
  id: string
  provider: string
  display_name: string
  config: Record<string, unknown> | null
  external_account_id: string
  status: string
  last_synced_at: string | null
  last_error: string | null
  created_at: string
}

export function toSourceConnection(row: SourceConnectionRow): SourceConnection {
  return {
    id: row.id,
    provider: row.provider as SourceConnection["provider"],
    displayName: row.display_name,
    config: row.config ?? {},
    externalAccountId: row.external_account_id,
    status: row.status as SourceConnection["status"],
    lastSyncedAt: row.last_synced_at,
    lastError: row.last_error,
    createdAt: row.created_at,
  }
}

export function buildSourceConnectionPatchPayload(patch: SourceConnectionPatch): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  if ("displayName" in patch) payload.display_name = patch.displayName
  if ("config" in patch) payload.config = patch.config
  if ("status" in patch) payload.status = patch.status
  if ("lastSyncedSha" in patch) payload.last_synced_sha = patch.lastSyncedSha
  if ("lastSyncedAt" in patch) payload.last_synced_at = patch.lastSyncedAt
  if ("lastError" in patch) payload.last_error = patch.lastError
  return payload
}

/** Row shape returned by vault_upsert_synced_document — a superset of ConversionRow's
 *  columns plus the sync-specific ones and the `action` the RPC took. */
export interface UpsertSyncedDocumentRow extends ConversionRow {
  action: string
  external_id: string | null
  external_url: string | null
  source_content_hash: string | null
  source_link_state: string
}

export function toUpsertSyncedDocumentResult(
  row: UpsertSyncedDocumentRow,
  projectIds: string[]
): UpsertSyncedDocumentResult {
  return {
    action: row.action as UpsertSyncedDocumentAction,
    document: {
      ...toVaultDocument(row, projectIds),
      externalId: row.external_id,
      externalUrl: row.external_url,
      sourceLinkState: row.source_link_state as SourceLinkState,
    },
  }
}
