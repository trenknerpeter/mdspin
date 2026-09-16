import "server-only"

// Orchestrates one connection's sync: backfill (cursored, resumable) and incremental
// (webhook-driven). Both funnel through repo.upsertSyncedDocument — the actual
// idempotency/adoption/mirror logic lives there (see vault_upsert_synced_document),
// not here. This file's only job is turning "a GitHub ref" into a list of
// (path, content) pairs and feeding them through.

import type { VaultRepo } from "@/lib/vault/repo"
import { getTree, getBlob, compareCommits, blobUrl, isMarkdownPath, type GitHubTreeEntry } from "./client"
import { resolvePush, type GitHubPushPayload, type PushResolution } from "./changes"
import { MAX_SYNC_FILES, GITHUB_BACKFILL_BATCH_SIZE } from "@/lib/vault/limits"

export interface SyncConfig {
  owner: string
  repo: string
  branch: string
  pathPrefix?: string | null
}

function underPathPrefix(path: string, pathPrefix?: string | null): boolean {
  if (!pathPrefix) return true
  const prefix = pathPrefix.replace(/^\/+/, "").replace(/\/+$/, "")
  return prefix === "" || path === prefix || path.startsWith(`${prefix}/`)
}

export interface SyncFileOutcome {
  path: string
  documentId: string | null
  action: string | null
  error: string | null
}

export interface SyncBatchResult {
  outcomes: SyncFileOutcome[]
  /** Document ids that were actually written (insert/adopt/update) — the caller uses
   *  this to decide what to inline-drain for summaries/embeddings. Excludes
   *  unchanged/skipped/errored files. */
  touchedIds: string[]
}

async function syncOneFile(
  repo: VaultRepo,
  connectionId: string,
  cfg: SyncConfig,
  installationId: string,
  entry: { path: string; sha: string },
  summaryStatus: "pending" | "manual"
): Promise<SyncFileOutcome> {
  try {
    const content = await getBlob(installationId, cfg.owner, cfg.repo, entry.sha)
    const result = await repo.upsertSyncedDocument({
      connectionId,
      externalId: entry.path,
      externalUrl: blobUrl(cfg.owner, cfg.repo, cfg.branch, entry.path),
      markdown: content,
      summaryStatus,
    })
    const touched = result.action === "inserted" || result.action === "adopted" || result.action === "updated"
    return { path: entry.path, documentId: touched ? result.document.id : null, action: result.action, error: null }
  } catch (err) {
    // An empty-after-normalization body (frontmatter-only stub) is an expected skip,
    // not a failure worth surfacing to the connection's last_error.
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes("empty after normalization")) {
      return { path: entry.path, documentId: null, action: "skipped_empty", error: null }
    }
    return { path: entry.path, documentId: null, action: null, error: message }
  }
}

/** Given a connection's current external_ids (from a DB query the caller already has
 *  to make) and the set of paths now present at the source, returns the ones that
 *  disappeared — for the caller to mark 'missing' (never deleted; see the design's
 *  "never delete" rule for a file GitHub says is gone). Pure, so it's trivially
 *  testable without a real API call. */
export function findGoneExternalIds(existingExternalIds: string[], presentPaths: Set<string>): string[] {
  return existingExternalIds.filter((id) => !presentPaths.has(id))
}

export interface BackfillCursor {
  /** Full markdown file list resolved once at the start of backfill, so re-listing the
   *  tree isn't needed on every resumed call. */
  paths: Array<{ path: string; sha: string }>
  nextIndex: number
  truncated: boolean
}

/** List the tree once and filter to in-scope markdown files, capped at MAX_SYNC_FILES.
 *  Called once at backfill start; the resulting cursor is persisted by the caller
 *  (source_connections.config.backfill_cursor) and consumed by runBackfillBatch. */
export async function startBackfill(
  installationId: string,
  cfg: SyncConfig
): Promise<{ cursor: BackfillCursor; refusedReason: string | null }> {
  const tree = await getTree(installationId, cfg.owner, cfg.repo, cfg.branch)
  const candidates = tree.entries.filter(
    (e): e is GitHubTreeEntry & { type: "blob" } =>
      e.type === "blob" && isMarkdownPath(e.path) && underPathPrefix(e.path, cfg.pathPrefix)
  )
  if (candidates.length > MAX_SYNC_FILES) {
    return {
      cursor: { paths: [], nextIndex: 0, truncated: tree.truncated },
      refusedReason: `This repo has ${candidates.length} markdown files, over the ${MAX_SYNC_FILES} limit. Narrow the path prefix and reconnect.`,
    }
  }
  return {
    cursor: {
      paths: candidates.map((e) => ({ path: e.path, sha: e.sha })),
      nextIndex: 0,
      truncated: tree.truncated,
    },
    refusedReason: null,
  }
}

/** Process up to GITHUB_BACKFILL_BATCH_SIZE files starting at cursor.nextIndex.
 *  Backfilled files use summaryStatus 'manual' (see the Stage 1 throughput decision —
 *  the daily drain cannot keep up with a fresh 300-document batch, so backfill doesn't
 *  enqueue automatic summarization at all; a per-connection "Summarize these" action
 *  enqueues explicitly once backfill is done). */
export async function runBackfillBatch(
  repo: VaultRepo,
  connectionId: string,
  installationId: string,
  cfg: SyncConfig,
  cursor: BackfillCursor
): Promise<{ result: SyncBatchResult; nextCursor: BackfillCursor | null }> {
  const batch = cursor.paths.slice(cursor.nextIndex, cursor.nextIndex + GITHUB_BACKFILL_BATCH_SIZE)
  const outcomes: SyncFileOutcome[] = []
  for (const entry of batch) {
    outcomes.push(await syncOneFile(repo, connectionId, cfg, installationId, entry, "manual"))
  }
  const nextIndex = cursor.nextIndex + batch.length
  const done = nextIndex >= cursor.paths.length
  return {
    result: { outcomes, touchedIds: outcomes.map((o) => o.documentId).filter((id): id is string => !!id) },
    nextCursor: done ? null : { ...cursor, nextIndex },
  }
}

/** Resolve and apply one push webhook. Returns null (a no-op) for a push to an
 *  untracked branch. */
export async function runIncrementalSync(
  repo: VaultRepo,
  connectionId: string,
  installationId: string,
  cfg: SyncConfig,
  payload: GitHubPushPayload,
  existingExternalIds: string[]
): Promise<{ resolution: PushResolution; result: SyncBatchResult | null; goneIds: string[] }> {
  const resolution = resolvePush(payload, cfg.branch)

  if (resolution.kind === "ignored_branch") {
    return { resolution, result: null, goneIds: [] }
  }
  if (resolution.kind === "branch_deleted") {
    return { resolution, result: null, goneIds: [] }
  }

  let addedOrModified: string[]
  let removed: string[]

  if (resolution.kind === "fast_path") {
    addedOrModified = [...resolution.added, ...resolution.modified]
    removed = resolution.removed
  } else {
    // full_rescan (created) or needs_compare (forced / commits truncated) — both fall
    // back to comparing against the tree, since a partial commits[] list can't be
    // trusted for either "what changed" or "what's now gone".
    const compare = resolution.kind === "needs_compare" ? await compareCommits(installationId, cfg.owner, cfg.repo, resolution.base, resolution.head) : null

    if (compare && !compare.truncated) {
      addedOrModified = compare.files.filter((f) => f.status !== "removed").map((f) => f.filename)
      removed = compare.files.filter((f) => f.status === "removed").map((f) => f.filename)
    } else {
      // Either genuinely a fresh branch, or compare failed/was truncated (force-push
      // whose `before` was garbage-collected, or a diff too large to trust) — fall all
      // the way back to a full tree re-scan, and derive `removed` by diffing against
      // what the DB currently thinks is linked.
      const tree = await getTree(installationId, cfg.owner, cfg.repo, payload.after)
      const present = new Set(
        tree.entries.filter((e) => e.type === "blob" && isMarkdownPath(e.path) && underPathPrefix(e.path, cfg.pathPrefix)).map((e) => e.path)
      )
      addedOrModified = [...present]
      removed = findGoneExternalIds(existingExternalIds, present)
    }
  }

  const inScope = addedOrModified.filter((p) => isMarkdownPath(p) && underPathPrefix(p, cfg.pathPrefix))

  // The webhook fast path doesn't carry blob shas (commits[] only has paths), so resolve
  // each in-scope file's current blob sha off the head ref via one tree call rather than
  // fetching per-file — for a typical push (a handful of files) this is one extra
  // request total, not one per file.
  const resolvedOutcomes: SyncFileOutcome[] = []
  if (inScope.length > 0) {
    const tree = await getTree(installationId, cfg.owner, cfg.repo, payload.after)
    const shaByPath = new Map(tree.entries.filter((e) => e.type === "blob").map((e) => [e.path, e.sha]))
    for (const path of inScope) {
      const sha = shaByPath.get(path)
      if (!sha) {
        resolvedOutcomes.push({ path, documentId: null, action: null, error: "File not found in tree at head." })
        continue
      }
      resolvedOutcomes.push(await syncOneFile(repo, connectionId, cfg, installationId, { path, sha }, "pending"))
    }
  }

  const removedInScope = removed.filter((p) => isMarkdownPath(p) && underPathPrefix(p, cfg.pathPrefix))

  return {
    resolution,
    result: {
      outcomes: resolvedOutcomes,
      touchedIds: resolvedOutcomes.map((o) => o.documentId).filter((id): id is string => !!id),
    },
    goneIds: removedInScope,
  }
}
