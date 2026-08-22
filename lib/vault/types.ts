// Shared domain types for the vault repo layer (Stage 2a).
//
// These types are consumed by lib/vault/repo.ts today and, later, by the REST routes
// (Stage 2d) and MCP tools (Stage 2e) that sit on top of it — this file has no
// Next.js/server-only imports so it stays importable from client components too.

/**
 * Who a repo call is allowed to see, and how that's enforced.
 *
 * A discriminated union rather than a single `userId` field so the *unsafe* path
 * literally cannot be constructed by accident: every variant carries a userId, and
 * `createVaultRepo` throws at construction if it's missing (see repo.ts). "rls" means
 * Postgres RLS is also filtering by `auth.uid()` on the underlying client; "explicit"
 * means the client is service-role (RLS bypassed) and this userId is the ONLY thing
 * keeping the query scoped to one account.
 */
export type VaultScope =
  | { enforce: "rls"; userId: string }
  | { enforce: "explicit"; userId: string }

/** A vault document, shaped for callers that never asked for its body. */
export interface VaultDocument {
  id: string
  filename: string
  title: string | null
  fileType: string
  wordCount: number | null
  /** Array-shaped from day one even though the DB is still single-`project_id` — see
   *  the Cloud Knowledge Hub strategy's "array-shaped project contracts" decision. This
   *  is what lets the Stage 5 many-to-many migration change no contract here. */
  projectIds: string[]
  tags: string[]
  sourceType: string
  convertedAt: string
  updatedAt: string
  version: number
  /** Only populated when explicitly requested (see GetDocumentOptions). One vault doc
   *  is 2.4MB — no list or default-detail call may return this for free. */
  markdown: string | null
}

export interface VaultProject {
  id: string
  name: string
  color: string | null
  createdAt: string
}

export interface VaultRelatedDocument {
  id: string
  filename: string
  title: string | null
  fileType: string
  wordCount: number | null
  tags: string[]
  projectId: string | null
  convertedAt: string
  rank: number
  strength: "strong" | "medium" | "weak"
}

export interface VaultTagCount {
  tag: string
  count: number
}

export interface VaultStats {
  documentCount: number
  projectCount: number
  topTags: VaultTagCount[]
}

export interface DocumentFilter {
  projectId?: string
  /** Match documents carrying ANY of these tags. */
  tags?: string[]
  /** Free-text match against filename/title/markdown — same semantics as the existing
   *  ILIKE search in lib/library.ts's listSpins. */
  search?: string
  limit?: number
  offset?: number
}

export interface GetDocumentOptions {
  includeMarkdown?: boolean
}

export interface PageInfo {
  limit: number
  offset: number
  total: number
  hasMore: boolean
  nextOffset: number | null
}

export interface Page<T> {
  data: T[]
  page: PageInfo
}
