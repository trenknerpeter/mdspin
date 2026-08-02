// Pure file-intake decision for the converter dropzone.
//
// Extracted from the inline filter chain in components/converter/use-converter.ts
// (handleFiles). That chain silently discarded files in four different ways, and being
// untestable is exactly why the bugs survived:
//
//   - unsupported extensions were filtered out with no feedback
//   - files over 20 MB were filtered out with no feedback
//   - `.slice(0, 20)` dropped files 21+ without a word
//   - name+size dedup silently ignored re-added files
//
// Now every dropped file comes back with a reason so the UI can say so.

import { isSupportedExt, isImageExt, MAX_IMAGES_PER_BATCH } from "@/lib/formats"
import { isIngestExt } from "@/lib/vault/limits"

export const MAX_CONVERT_FILE_SIZE = 20 * 1024 * 1024
export const MAX_CONVERT_FILES = 20

export type RejectionReason =
  | "unsupported"
  | "too_large"
  | "duplicate"
  | "over_file_limit"
  | "over_image_limit"
  | "markdown_goes_to_vault"

export interface FileLike {
  name: string
  size: number
}

export interface Rejection {
  name: string
  reason: RejectionReason
}

export interface IntakeResult<T extends FileLike> {
  /** Files to append to the current selection. */
  accepted: T[]
  /** Everything dropped, with a reason, in the order encountered. */
  rejected: Rejection[]
}

export interface IntakeOptions {
  maxSize?: number
  maxFiles?: number
  maxImages?: number
}

function extOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? ""
}

function keyOf(f: FileLike): string {
  return `${f.name}:${f.size}`
}

/**
 * Decide which incoming files join the existing selection.
 *
 * Evaluated per file, in order, against the running totals of the combined set — so the
 * caps are enforced without ever silently discarding something already accepted. Markdown
 * gets its own reason rather than the generic "unsupported", because markdown needs no
 * conversion at all and the UI points the user at the vault instead.
 */
export function partitionIncomingFiles<T extends FileLike>(
  existing: FileLike[],
  incoming: T[],
  opts: IntakeOptions = {}
): IntakeResult<T> {
  const maxSize = opts.maxSize ?? MAX_CONVERT_FILE_SIZE
  const maxFiles = opts.maxFiles ?? MAX_CONVERT_FILES
  const maxImages = opts.maxImages ?? MAX_IMAGES_PER_BATCH

  const seen = new Set(existing.map(keyOf))
  let fileCount = existing.length
  let imageCount = existing.filter((f) => isImageExt(extOf(f.name))).length

  const accepted: T[] = []
  const rejected: Rejection[] = []

  for (const f of incoming) {
    const ext = extOf(f.name)

    // Markdown before the generic unsupported check: it IS unsupported for conversion,
    // but the actionable message is completely different.
    if (isIngestExt(f.name) && !isSupportedExt(ext)) {
      rejected.push({ name: f.name, reason: "markdown_goes_to_vault" })
      continue
    }
    if (!isSupportedExt(ext)) {
      rejected.push({ name: f.name, reason: "unsupported" })
      continue
    }
    if (f.size > maxSize) {
      rejected.push({ name: f.name, reason: "too_large" })
      continue
    }
    if (seen.has(keyOf(f))) {
      rejected.push({ name: f.name, reason: "duplicate" })
      continue
    }
    if (fileCount >= maxFiles) {
      rejected.push({ name: f.name, reason: "over_file_limit" })
      continue
    }
    if (isImageExt(ext) && imageCount >= maxImages) {
      rejected.push({ name: f.name, reason: "over_image_limit" })
      continue
    }

    seen.add(keyOf(f))
    fileCount++
    if (isImageExt(ext)) imageCount++
    accepted.push(f)
  }

  return { accepted, rejected }
}

/** Human copy for each reason. `count` drives pluralisation at the call site. */
export function describeRejection(reason: RejectionReason, count: number): string {
  const s = count === 1 ? "" : "s"
  switch (reason) {
    case "markdown_goes_to_vault":
      return count === 1
        ? "1 markdown file doesn't need converting — add it straight to your Vault"
        : `${count} markdown files don't need converting — add them straight to your Vault`
    case "unsupported":
      return `${count} file${s} skipped — unsupported format`
    case "too_large":
      return `${count} file${s} skipped — over the 20 MB limit`
    case "duplicate":
      return `${count} file${s} already added`
    case "over_file_limit":
      return `${count} file${s} skipped — ${MAX_CONVERT_FILES}-file limit reached`
    case "over_image_limit":
      return `${count} image${s} skipped — max ${MAX_IMAGES_PER_BATCH} images per batch`
  }
}

/** Group rejections by reason, preserving first-encountered order. */
export function groupRejections(
  rejected: Rejection[]
): { reason: RejectionReason; names: string[] }[] {
  const order: RejectionReason[] = []
  const byReason = new Map<RejectionReason, string[]>()
  for (const r of rejected) {
    if (!byReason.has(r.reason)) {
      byReason.set(r.reason, [])
      order.push(r.reason)
    }
    byReason.get(r.reason)!.push(r.name)
  }
  return order.map((reason) => ({ reason, names: byReason.get(reason)! }))
}
