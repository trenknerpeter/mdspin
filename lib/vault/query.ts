// Pure request-parameter handling for the vault repo: clamping, defaulting, and escaping.
// Kept separate from repo.ts so it's testable without a Supabase client and reusable by
// the REST layer (Stage 2d) for parsing querystring params before they ever reach the repo.

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

/** Clamp a possibly-absent, possibly-garbage limit into [1, MAX_LIMIT]. NaN, negative,
 *  and non-finite values fall back to the default rather than erroring — a malformed
 *  `?limit=` is a client mistake worth tolerating, not worth a 400. */
export function clampLimit(raw: number | undefined, max = MAX_LIMIT): number {
  if (raw === undefined || !Number.isFinite(raw)) return DEFAULT_LIMIT
  return Math.min(Math.max(Math.trunc(raw), 1), max)
}

/** Same tolerance policy as clampLimit: garbage in, zero out, never a thrown error. */
export function clampOffset(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw)) return 0
  return Math.max(Math.trunc(raw), 0)
}

/**
 * Escape a free-text search term for safe use inside `.ilike()`.
 *
 * PostgREST's ilike operator treats `%` and `_` as SQL LIKE wildcards and `,` as its own
 * filter-list separator. Without escaping, a search for "100% done" would match anything
 * containing "100", and a search containing a comma would corrupt an `.or(...)` filter
 * string built by hand (see lib/library.ts's existing `q.or(...)` pattern, which this
 * mirrors). Backslash must be escaped first, or escaping % / _ afterwards would double-
 * escape the backslashes just inserted.
 */
export function escapeIlikeTerm(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/,/g, "\\,")
}

/** Build the `{data, page}` envelope every list method returns. `total` is the count
 *  BEFORE this page was sliced off, as returned by a `.select(..., {count:"exact"})`. */
export function buildPage<T>(
  data: T[],
  opts: { limit: number; offset: number; total: number }
): { data: T[]; page: { limit: number; offset: number; total: number; hasMore: boolean; nextOffset: number | null } } {
  const hasMore = opts.offset + data.length < opts.total
  return {
    data,
    page: {
      limit: opts.limit,
      offset: opts.offset,
      total: opts.total,
      hasMore,
      nextOffset: hasMore ? opts.offset + data.length : null,
    },
  }
}
