// Pure construction of vault insert rows from parsed markdown files.
//
// Everything here runs in the BROWSER during the scan phase so the review table can show
// the user exactly what will land before a single byte is uploaded. That is the whole UX
// win of client-side parsing, and it's why none of this may touch supabase or fs.

import { splitFrontmatter } from "./frontmatter"
import { deriveTitle } from "./title"
import { normalizeForHash } from "./hash"
import { tagsFromFrontmatter, normalizeTags } from "./tags"
import { mapRelativePath, type FolderMappingMode } from "./paths"
import { countWords } from "./text"
import { MAX_DOC_CHARS, SUMMARY_MAX_CHARS } from "./limits"

/** Frontmatter keys promoted to real columns. Everything else is preserved as jsonb. */
const RECOGNISED_KEYS = new Set([
  "title",
  "tags",
  "tag",
  "summary",
  "description",
  "excerpt",
  "project",
  "created",
  "date",
])

/** Serialized `frontmatter` jsonb larger than this is dropped — it's metadata, not content. */
const FRONTMATTER_JSONB_CAP = 16_384

export type IngestSourceType = "upload" | "note" | "api" | "mcp"

export type SkipReason =
  | "too_large"
  | "empty"
  | "duplicate_in_batch"
  | "already_in_vault"
  | "ignored_path"
  | "unsupported_type"

export interface RawIngestFile {
  /** Basename, e.g. "kickoff.md". */
  filename: string
  /** webkitRelativePath when known, otherwise just the filename. */
  relativePath?: string | null
  /** Full file text, frontmatter included. */
  text: string
}

/** The row shape inserted into `conversions`, minus server-owned fields. */
export interface IngestRow {
  filename: string
  file_type: string
  title: string
  markdown_text: string
  word_count: number
  tags: string[]
  in_vault: true
  source_type: IngestSourceType
  source_path: string | null
  source_created_at: string | null
  frontmatter: Record<string, string | string[]> | null
  content_hash: string | null
  summary: string | null
  summary_status: "pending" | "manual"
}

export interface IngestDoc {
  row: IngestRow
  /**
   * Project NAMES, not ids — the client only knows folder names, so the server resolves
   * or creates. An array from day one even though the DB is still one-project-per-doc,
   * so the many-to-many migration changes no contract.
   */
  projectNames: string[]
  /** Normalized body, for hashing. Not sent to the server. */
  normalizedBody: string
}

export interface SkippedFile {
  filename: string
  relativePath: string | null
  title: string
  reason: SkipReason
}

function fileTypeOf(filename: string): string {
  return filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "md"
}

/** Coerce a frontmatter date to an ISO string, or null if unparseable. */
function parseDate(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return null
  const ms = Date.parse(raw)
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}

function firstString(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v
  return s && s.trim() ? s.trim() : undefined
}

/**
 * Build one insert row from a raw file.
 *
 * Returns null when the file should not be imported at all (empty or over the size cap);
 * the caller reports the reason rather than silently dropping it.
 */
export function buildIngestDoc(
  file: RawIngestFile,
  opts: {
    mode: FolderMappingMode
    defaultProjectNames?: string[]
    defaultTags?: string[]
    sourceType?: IngestSourceType
  }
): { doc: IngestDoc } | { skip: SkipReason } {
  if (file.text.length > MAX_DOC_CHARS) return { skip: "too_large" }

  const { data, body } = splitFrontmatter(file.text)
  const normalizedBody = normalizeForHash(file.text)
  if (!normalizedBody) return { skip: "empty" }

  const relativePath = file.relativePath ?? null
  const pathMapping = relativePath
    ? mapRelativePath(relativePath, opts.mode)
    : { projectName: null, tags: [] }

  // Frontmatter `project` beats folder inference — an explicit declaration in the file
  // is a stronger signal than where the file happens to sit.
  const fmProject = firstString(data.project)
  const projectNames = normalizeProjectNames([
    ...(fmProject ? [fmProject] : pathMapping.projectName ? [pathMapping.projectName] : []),
    ...(opts.defaultProjectNames ?? []),
  ])

  const tags = normalizeTags([
    ...tagsFromFrontmatter(data.tags ?? data.tag),
    ...pathMapping.tags,
    ...(opts.defaultTags ?? []),
  ])

  // A summary supplied in frontmatter is marked 'manual' so the Make drainer skips it —
  // free, and it costs zero LLM operations.
  const fmSummary = firstString(data.summary ?? data.description ?? data.excerpt)

  const extra: Record<string, string | string[]> = {}
  for (const [k, v] of Object.entries(data)) {
    if (!RECOGNISED_KEYS.has(k.toLowerCase())) extra[k] = v
  }
  const hasExtra = Object.keys(extra).length > 0
  const frontmatter =
    hasExtra && JSON.stringify(extra).length <= FRONTMATTER_JSONB_CAP ? extra : null

  return {
    doc: {
      row: {
        // filename and file_type are NOT NULL in the DB, so both must always resolve.
        filename: file.filename || "untitled.md",
        file_type: fileTypeOf(file.filename),
        title: deriveTitle({
          frontmatterTitle: data.title,
          body,
          filename: file.filename,
        }),
        // Body WITHOUT frontmatter: search_vector is generated from markdown_text, so
        // YAML keys would pollute relatedness — every doc containing "title:" would
        // match every other on that token.
        markdown_text: body,
        word_count: countWords(body),
        tags,
        in_vault: true,
        source_type: opts.sourceType ?? "upload",
        source_path: relativePath,
        // Frontmatter dates go here, NEVER to converted_at, which orders History,
        // drives the dashboard activity chart and is the vault sort key.
        source_created_at: parseDate(data.created ?? data.date),
        frontmatter,
        content_hash: null, // filled in asynchronously by the caller
        summary: fmSummary ? fmSummary.slice(0, SUMMARY_MAX_CHARS) : null,
        summary_status: fmSummary ? "manual" : "pending",
      },
      projectNames,
      normalizedBody,
    },
  }
}

/** Trim, drop empties, de-duplicate case-insensitively, keep first-seen casing. */
export function normalizeProjectNames(names: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const n of names) {
    const t = n.trim()
    if (!t) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

/**
 * Drop docs whose content hash duplicates an earlier doc in the same batch.
 * Keeps the first occurrence; the rest are reported so the count is visible.
 *
 * Docs with a null hash (crypto.subtle unavailable) are never treated as duplicates —
 * we cannot know, and wrongly skipping a file is worse than a possible duplicate.
 */
export function dedupeWithinBatch(
  docs: IngestDoc[]
): { kept: IngestDoc[]; skipped: SkippedFile[] } {
  const seen = new Set<string>()
  const kept: IngestDoc[] = []
  const skipped: SkippedFile[] = []

  for (const d of docs) {
    const h = d.row.content_hash
    if (h && seen.has(h)) {
      skipped.push({
        filename: d.row.filename,
        relativePath: d.row.source_path,
        title: d.row.title,
        reason: "duplicate_in_batch",
      })
      continue
    }
    if (h) seen.add(h)
    kept.push(d)
  }

  return { kept, skipped }
}

export interface IngestOutcome {
  ready: number
  skipped: Record<SkipReason, number>
  totalSkipped: number
}

/** Roll skip reasons into the counters shown above the review table. */
export function summarizeIngestOutcome(ready: number, skipped: SkippedFile[]): IngestOutcome {
  const counts: Record<SkipReason, number> = {
    too_large: 0,
    empty: 0,
    duplicate_in_batch: 0,
    already_in_vault: 0,
    ignored_path: 0,
    unsupported_type: 0,
  }
  for (const s of skipped) counts[s.reason]++
  return { ready, skipped: counts, totalSkipped: skipped.length }
}
