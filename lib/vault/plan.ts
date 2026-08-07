// Pure planning step for vault ingest: which files become docs, which are skipped and why.
//
// This is the whole decision the review screen shows before anything is written, so it
// must stay callable with no browser and no Supabase — a future MCP or server-side ingest
// path reuses it unchanged. File reading and hashing (both async, both real I/O) happen
// in the caller; this only ever sees already-read text and already-computed hashes.

import {
  buildIngestDoc,
  dedupeWithinBatch,
  summarizeIngestOutcome,
  type IngestDoc,
  type IngestOutcome,
  type IngestSourceType,
  type RawIngestFile,
  type SkippedFile,
} from "./ingest"
import { isIgnoredPath, type FolderMappingMode } from "./paths"
import { isIngestExt } from "./limits"

export interface HashedIngestFile extends RawIngestFile {
  /** Precomputed content hash, or null when it couldn't be computed (see hash.ts). */
  hash: string | null
}

export interface IngestSettings {
  mode: FolderMappingMode
  defaultProjectNames?: string[]
  defaultTags?: string[]
  sourceType?: IngestSourceType
}

export interface IngestPlan {
  readyDocs: IngestDoc[]
  outcome: IngestOutcome
}

/**
 * Decide the fate of every scanned file: ready to import, or skipped with a reason.
 *
 * Path- and extension-filtering happen here, ahead of buildIngestDoc, so a folder import
 * can never turn a `.obsidian/workspace.json` or a `.png` into a vault document — the two
 * checks buildIngestDoc alone cannot make, since it has no path-ignore or extension rule.
 */
export function planIngest(
  files: HashedIngestFile[],
  settings: IngestSettings,
  existingHashes: Set<string>
): IngestPlan {
  const skipped: SkippedFile[] = []
  const built: IngestDoc[] = []

  for (const f of files) {
    const relativePath = f.relativePath ?? null

    if (relativePath && isIgnoredPath(relativePath)) {
      skipped.push({ filename: f.filename, relativePath, title: f.filename, reason: "ignored_path" })
      continue
    }
    if (!isIngestExt(f.filename)) {
      skipped.push({ filename: f.filename, relativePath, title: f.filename, reason: "unsupported_type" })
      continue
    }

    const result = buildIngestDoc(f, settings)
    if ("skip" in result) {
      skipped.push({ filename: f.filename, relativePath, title: f.filename, reason: result.skip })
      continue
    }

    result.doc.row.content_hash = f.hash
    if (f.hash && existingHashes.has(f.hash)) {
      skipped.push({
        filename: f.filename,
        relativePath,
        title: result.doc.row.title,
        reason: "already_in_vault",
      })
      continue
    }

    built.push(result.doc)
  }

  const { kept, skipped: batchDupes } = dedupeWithinBatch(built)
  const allSkipped = [...skipped, ...batchDupes]
  return { readyDocs: kept, outcome: summarizeIngestOutcome(kept.length, allSkipped) }
}
