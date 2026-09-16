// Resolves a GitHub `push` webhook payload into a definitive changed-file list.
// Pure and dependency-free so it's unit-testable without a real GitHub API call —
// deciding WHICH strategy to use is exactly the part that has the sharp edges
// (truncation, force-push, branch creation/deletion), and getting it wrong means
// silently missing changes with no error, ever.

export interface GitHubCommit {
  added: string[]
  modified: string[]
  removed: string[]
}

export interface GitHubPushPayload {
  ref: string // "refs/heads/main"
  before: string
  after: string
  created: boolean
  deleted: boolean
  forced: boolean
  /** Total number of commits in the push — NOT the length of `commits`, which GitHub
   *  caps at 20 regardless of how many actually happened. */
  size?: number
  commits: GitHubCommit[]
}

export type PushResolution =
  | { kind: "ignored_branch" }
  | { kind: "branch_deleted" }
  | { kind: "full_rescan"; reason: "created" | "compare_failed" }
  | { kind: "needs_compare"; base: string; head: string }
  | { kind: "fast_path"; added: string[]; modified: string[]; removed: string[] }

/** Extract "main" from "refs/heads/main"; null for anything else (tags, etc.) — a
 *  connection only tracks one branch, so a push to another ref is not relevant at all. */
export function branchFromRef(ref: string): string | null {
  const match = /^refs\/heads\/(.+)$/.exec(ref)
  return match ? match[1] : null
}

/**
 * Decide how to resolve this push into a file list.
 *
 * `commits[]` is a fast path ONLY. It's capped at 20 entries (`payload.size` reports
 * the true count), and on `created`/`forced` pushes it may not even reflect what
 * actually needs re-syncing (a `created` branch has no diff base at all; a `forced`
 * push may have rewritten history the commits array doesn't describe honestly).
 */
export function resolvePush(payload: GitHubPushPayload, trackedBranch: string): PushResolution {
  const branch = branchFromRef(payload.ref)
  if (branch !== trackedBranch) return { kind: "ignored_branch" }

  if (payload.deleted) return { kind: "branch_deleted" }
  if (payload.created) return { kind: "full_rescan", reason: "created" }

  const size = payload.size ?? payload.commits.length
  if (payload.forced || payload.commits.length !== size) {
    return { kind: "needs_compare", base: payload.before, head: payload.after }
  }

  // A path can appear in more than one commit within the same push (added then later
  // removed, or removed then re-added) — a naive union of three independent sets can't
  // tell those two cases apart once flattened. A single last-write-wins map can: commits
  // are processed in order, and a later commit's classification for a path always
  // overwrites an earlier one, which is exactly the net effect from `before` to `after`.
  const state = new Map<string, "added" | "modified" | "removed">()
  for (const commit of payload.commits) {
    for (const p of commit.added) state.set(p, "added")
    for (const p of commit.modified) state.set(p, "modified")
    for (const p of commit.removed) state.set(p, "removed")
  }

  const added: string[] = []
  const modified: string[] = []
  const removed: string[] = []
  for (const [path, kind] of state) {
    if (kind === "added") added.push(path)
    else if (kind === "modified") modified.push(path)
    else removed.push(path)
  }

  return { kind: "fast_path", added, modified, removed }
}
