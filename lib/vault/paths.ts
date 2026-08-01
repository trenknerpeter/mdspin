// Mapping a folder-import path onto projects and tags.
//
// Input is a webkitRelativePath, which always begins with the folder the user picked:
//   "MyVault/Clients/Acme/notes/kickoff.md"
// The picked root carries no information (it's just where the vault happens to live), so
// it is always stripped.

import { normalizeTags } from "./tags"

export type FolderMappingMode = "top-folder-project" | "all-tags" | "ignore"

export interface PathMapping {
  /** Project NAME, not id — the client only knows folder names. Server resolves or creates. */
  projectName: string | null
  tags: string[]
}

/** Directory names whose contents are never worth importing. */
const IGNORED_DIRS = new Set([
  ".obsidian",
  ".obsidian-mobile",
  ".trash",
  ".git",
  ".github",
  "node_modules",
  ".vscode",
  ".idea",
  "__pycache__",
])

/**
 * True when a path should be skipped entirely. Covers tool directories and any
 * dot-prefixed segment or filename — the count is reported to the user rather than
 * silently dropped, so they can see what was excluded.
 */
export function isIgnoredPath(relPath: string): boolean {
  const segments = relPath.split("/").filter(Boolean)
  return segments.some(
    (seg, i) =>
      IGNORED_DIRS.has(seg.toLowerCase()) ||
      // dot-prefixed directory, or a dotfile in the final position
      (seg.startsWith(".") && (i < segments.length - 1 || seg.lastIndexOf(".") === 0))
  )
}

/**
 * Derive project + tags from a relative path.
 *
 * Default mode is "top-folder-project": the first folder below the picked root becomes a
 * project, and everything deeper becomes tags. Making every segment a project is
 * technically defensible now that membership is many-to-many, but practically awful — the
 * rail fills with `notes`, `daily`, `inbox`, `templates`. Projects are a curated shelf;
 * tags are cheap.
 */
export function mapRelativePath(relPath: string, mode: FolderMappingMode): PathMapping {
  if (mode === "ignore") return { projectName: null, tags: [] }

  const segments = relPath.split("/").filter(Boolean)
  // Drop the filename, then drop the picked root.
  const dirs = segments.slice(0, -1).slice(1)

  if (dirs.length === 0) return { projectName: null, tags: [] }

  if (mode === "all-tags") {
    return { projectName: null, tags: normalizeTags(dirs) }
  }

  return {
    projectName: dirs[0],
    tags: normalizeTags(dirs.slice(1)),
  }
}
