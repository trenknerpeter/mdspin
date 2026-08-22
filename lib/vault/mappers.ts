// Pure row -> domain mapping. Isolated from repo.ts so the DB's column-naming
// conventions (snake_case, singular `project_id`) never leak past this one seam.

import type { VaultDocument, VaultProject, VaultRelatedDocument } from "./types"

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
}

export interface ProjectRow {
  id: string
  name: string
  color: string | null
  created_at: string
}

export function toVaultDocument(row: ConversionRow): VaultDocument {
  return {
    id: row.id,
    filename: row.filename,
    title: row.title,
    fileType: row.file_type,
    wordCount: row.word_count,
    // Single project_id -> array, per the array-shaped-contract decision (types.ts).
    projectIds: row.project_id ? [row.project_id] : [],
    tags: row.tags ?? [],
    sourceType: row.source_type,
    convertedAt: row.converted_at,
    updatedAt: row.updated_at,
    version: row.version,
    markdown: row.markdown_text ?? null,
  }
}

export function toVaultProject(row: ProjectRow): VaultProject {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
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
