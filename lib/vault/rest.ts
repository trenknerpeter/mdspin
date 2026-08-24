// Domain -> wire-format JSON for the REST layer (Stage 2d). The one place camelCase
// domain objects become the snake_case JSON that matches MDSpin's existing public API
// convention (app/developer-api) — a Make scenario or MCP client sees one consistent
// style across MDSpin's whole public surface, not two.

import type {
  Page,
  PageInfo,
  VaultDocument,
  VaultProject,
  VaultRelatedDocument,
  VaultSearchResult,
  VaultStats,
} from "./types"

export function documentToJson(doc: VaultDocument) {
  return {
    id: doc.id,
    filename: doc.filename,
    title: doc.title,
    file_type: doc.fileType,
    word_count: doc.wordCount,
    project_ids: doc.projectIds,
    tags: doc.tags,
    source_type: doc.sourceType,
    converted_at: doc.convertedAt,
    updated_at: doc.updatedAt,
    version: doc.version,
    markdown_text: doc.markdown,
  }
}

export function projectToJson(project: VaultProject) {
  return {
    id: project.id,
    name: project.name,
    color: project.color,
    created_at: project.createdAt,
  }
}

export function relatedDocumentToJson(doc: VaultRelatedDocument) {
  return {
    id: doc.id,
    filename: doc.filename,
    title: doc.title,
    file_type: doc.fileType,
    word_count: doc.wordCount,
    tags: doc.tags,
    project_id: doc.projectId,
    converted_at: doc.convertedAt,
    rank: doc.rank,
    strength: doc.strength,
  }
}

export function searchResultToJson(result: VaultSearchResult) {
  return {
    ...documentToJson(result),
    rank: result.rank,
    snippet: result.snippet,
  }
}

export function statsToJson(stats: VaultStats) {
  return {
    document_count: stats.documentCount,
    project_count: stats.projectCount,
    top_tags: stats.topTags,
  }
}

function pageInfoToJson(info: PageInfo) {
  return {
    limit: info.limit,
    offset: info.offset,
    total: info.total,
    has_more: info.hasMore,
    next_offset: info.nextOffset,
  }
}

export function pageToJson<T, J>(
  page: Page<T>,
  itemToJson: (item: T) => J
): { data: J[]; page: ReturnType<typeof pageInfoToJson> } {
  return { data: page.data.map(itemToJson), page: pageInfoToJson(page.page) }
}
