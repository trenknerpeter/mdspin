// Compact JSON shaping for MCP tool output — deliberately separate from
// lib/vault/rest.ts's snake_case mappers. REST's null-inclusive convention suits a typed
// TS client; every key here costs tokens in an LLM's context window, so absent/empty
// fields are omitted rather than sent as null.

import type { VaultDocument, VaultProject, VaultRelatedDocument, VaultSearchResult, VaultStats } from "@/lib/vault/types"
import type { Heading } from "@/lib/vault/title"

function prune<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue
    if (Array.isArray(value) && value.length === 0) continue
    ;(out as Record<string, unknown>)[key] = value
  }
  return out
}

export function compactDocMeta(doc: VaultDocument) {
  return prune({
    id: doc.id,
    filename: doc.filename,
    title: doc.title,
    project_ids: doc.projectIds,
    tags: doc.tags,
    word_count: doc.wordCount,
    source_type: doc.sourceType,
    updated_at: doc.updatedAt,
    version: doc.version,
  })
}

export function compactProject(project: VaultProject) {
  return prune({ id: project.id, name: project.name, color: project.color })
}

export function compactProjectDetail(project: VaultProject) {
  return prune({
    id: project.id,
    name: project.name,
    color: project.color,
    instructions: project.instructions,
    created_at: project.createdAt,
  })
}

export function compactRelated(doc: VaultRelatedDocument) {
  return prune({
    id: doc.id,
    filename: doc.filename,
    title: doc.title,
    project_id: doc.projectId,
    tags: doc.tags,
    rank: doc.rank,
    strength: doc.strength,
  })
}

export function compactSearchResult(result: VaultSearchResult) {
  return { ...compactDocMeta(result), rank: result.rank, snippet: result.snippet }
}

export function compactStats(stats: VaultStats) {
  return prune({
    document_count: stats.documentCount,
    project_count: stats.projectCount,
    top_tags: stats.topTags,
  })
}

export function compactHeading(heading: Heading) {
  return prune({ level: heading.level, text: heading.text })
}
