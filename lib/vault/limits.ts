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
/** Stage 3: give up on embedding a doc after this many failed attempts, same retry
 *  philosophy as SUMMARY_MAX_ATTEMPTS. */
export const EMBEDDING_MAX_ATTEMPTS = 3
/** Chunks per edge-function call. Live-tested against the deployed function
 *  (2026-08-29) and found NOT to be a timeout problem at all: batches of 6+ texts in one
 *  invocation reliably return 546 WORKER_RESOURCE_LIMIT ("not having enough compute
 *  resources") in ~2.5s regardless of batch size 6-10, and even a batch of 5 fails
 *  depending on which chunks are in it (larger/more-complex text lowers the threshold
 *  further). A batch of 1 was stress-tested with the largest real chunk in the vault,
 *  repeated 5x back-to-back, with zero failures. The edge function processes texts
 *  sequentially inside one invocation and something about that (likely the ONNX runtime's
 *  per-inference memory not being freed between calls) accumulates past the Edge
 *  Runtime's worker memory ceiling — batching within a single invocation is not safe at
 *  any size above 1 until that's fixed inside the function itself. */
export const EMBED_REQUEST_BATCH = 1
/** Timeout for the backfill's embed calls — far longer than EMBED_TIMEOUT_MS (the
 *  hot-search-path default in lib/vault/embeddings.ts). With EMBED_REQUEST_BATCH now 1,
 *  a single real call takes well under a second (~0.4-0.7s observed live); this generous
 *  ceiling exists for a cold model load or a genuinely slow invocation, not because batch
 *  processing needs a long budget anymore. */
export const EMBED_BACKFILL_TIMEOUT_MS = 45_000

export function isIngestExt(filename: string): boolean {
  const ext = filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
  return !!ext && (INGEST_EXTS as readonly string[]).includes(ext)
}
