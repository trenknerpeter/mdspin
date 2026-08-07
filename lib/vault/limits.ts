// Single source of truth for ingest limits, mirroring the role lib/formats.ts plays
// for conversions.

/** Extensions accepted by vault ingest. Deliberately NOT in lib/formats.ts — that
 *  constant is server-side conversion validation, and listing md there would make the
 *  convert routes forward markdown to the backend and burn a rate-limit unit. */
export const INGEST_EXTS = ["md", "markdown", "mdx", "txt"] as const

/** Files per folder import. Refused with a message, never silently truncated. */
export const MAX_IMPORT_FILES = 50
/** Per-document character cap. */
export const MAX_DOC_CHARS = 2_000_000
/** Total characters across one import. */
export const MAX_IMPORT_CHARS = 20_000_000

/** Vercel caps route-handler request bodies at 4.5 MB. `bodySizeLimit: "25mb"` in
 *  next.config.mjs applies to Server Actions only, NOT route handlers — sizing chunks
 *  against 25 MB produces an unfixable-looking 413. 3 MB leaves JSON overhead headroom. */
export const COMMIT_CHUNK_MAX_BYTES = 3_000_000
export const COMMIT_CHUNK_MAX_COUNT = 25

/** Hashes per existence-probe request. 500 × 64 bytes ≈ 32 KB. */
export const HASH_PROBE_CHUNK = 500

/** Concurrent File.text() reads during the scan phase; keeps the main thread responsive. */
export const SCAN_CONCURRENCY = 8

/** Chars of each doc sent to the summary LLM. Lower than CLUSTER_DOC_CAP (6000) because
 *  a 40-word summary only needs the head plus an outline. */
export const SUMMARY_DOC_CAP = 4000
/** Docs per Make webhook call. Make bills per operation, so batching turns a 200-doc
 *  import into ~40 scenario runs instead of 200. */
export const SUMMARY_BATCH_SIZE = 5
/** Hard server-side cap on a stored summary. A summary that isn't short defeats the
 *  purpose — enforce it rather than trusting the model. */
export const SUMMARY_MAX_CHARS = 400
/** Give up after this many failed attempts per doc. */
export const SUMMARY_MAX_ATTEMPTS = 3

export function isIngestExt(filename: string): boolean {
  const ext = filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
  return !!ext && (INGEST_EXTS as readonly string[]).includes(ext)
}
