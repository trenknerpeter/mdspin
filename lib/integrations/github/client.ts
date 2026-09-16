import "server-only"

// Thin GitHub REST API client for the sync connector. No @octokit/rest dependency —
// this repo prefers plain fetch (see lib/backend.ts, lib/vault/embeddings.ts), and the
// handful of endpoints this needs don't justify the dependency weight.

import { getInstallationToken } from "./auth"

const GITHUB_API = "https://api.github.com"

async function githubFetch(installationId: string, path: string, init?: RequestInit): Promise<Response> {
  const token = await getInstallationToken(installationId)
  return fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init?.headers,
    },
  })
}

export interface GitHubTreeEntry {
  path: string
  type: "blob" | "tree" | "commit"
  sha: string
  size?: number
}

export interface GitHubTreeResult {
  entries: GitHubTreeEntry[]
  /** True when GitHub cut the response short. The caller must NOT present this as a
   *  complete listing — the file cap in lib/vault/limits.ts caps how much of the result
   *  we USE, but this flag says whether the result was even truthful to begin with. */
  truncated: boolean
}

export async function getTree(
  installationId: string,
  owner: string,
  repo: string,
  ref: string
): Promise<GitHubTreeResult> {
  const res = await githubFetch(installationId, `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`)
  if (!res.ok) throw new Error(`getTree failed (${res.status}): ${await res.text()}`)
  const data = (await res.json()) as { tree: GitHubTreeEntry[]; truncated: boolean }
  return { entries: data.tree, truncated: data.truncated }
}

/** Fetch a blob's content as a UTF-8 string. Deliberately NOT /repos/{o}/{r}/contents/{path}
 *  — that endpoint caps at 1MB and returns a download_url-only stub above it, well below
 *  the vault's own MAX_DOC_CHARS (2M chars). The blobs endpoint's cap is 100MB. */
export async function getBlob(installationId: string, owner: string, repo: string, sha: string): Promise<string> {
  const res = await githubFetch(installationId, `/repos/${owner}/${repo}/git/blobs/${sha}`)
  if (!res.ok) throw new Error(`getBlob failed (${res.status}): ${await res.text()}`)
  const data = (await res.json()) as { content: string; encoding: string }
  if (data.encoding !== "base64") throw new Error(`Unexpected blob encoding: ${data.encoding}`)
  return Buffer.from(data.content, "base64").toString("utf-8")
}

export interface GitHubRepoInfo {
  id: number
  owner: string
  name: string
  defaultBranch: string
  fullName: string
}

export async function getRepo(installationId: string, owner: string, repo: string): Promise<GitHubRepoInfo> {
  const res = await githubFetch(installationId, `/repos/${owner}/${repo}`)
  if (!res.ok) throw new Error(`getRepo failed (${res.status}): ${await res.text()}`)
  const data = (await res.json()) as { id: number; default_branch: string; full_name: string; owner: { login: string }; name: string }
  return { id: data.id, owner: data.owner.login, name: data.name, defaultBranch: data.default_branch, fullName: data.full_name }
}

/** Repos this SPECIFIC installation actually grants access to — not every repo the
 *  installing user can see. This is what makes "require exactly one repo" at connect
 *  time a meaningful check: if it returned every repo the user owns, the check would be
 *  vacuous. Requires an installation-scoped token, not the user token. */
export async function listInstallationRepos(installationId: string): Promise<GitHubRepoInfo[]> {
  const res = await githubFetch(installationId, `/installation/repositories?per_page=100`)
  if (!res.ok) throw new Error(`listInstallationRepos failed (${res.status}): ${await res.text()}`)
  const data = (await res.json()) as {
    repositories: Array<{ id: number; name: string; full_name: string; default_branch: string; owner: { login: string } }>
  }
  return data.repositories.map((r) => ({
    id: r.id,
    owner: r.owner.login,
    name: r.name,
    defaultBranch: r.default_branch,
    fullName: r.full_name,
  }))
}

export interface CompareResult {
  status: "ahead" | "behind" | "identical" | "diverged"
  files: Array<{ filename: string; status: string; previous_filename?: string }>
  /** GitHub caps the compare diff at 300 files / 3000 total changes and sets this when
   *  it truncates — same truthfulness caveat as GitHubTreeResult.truncated. */
  truncated: boolean
}

/** Authoritative diff between two commits. The push webhook's own `commits[]` array is
 *  only a fast path (capped at 20 entries, useless on `created`/`forced` pushes) — this
 *  is the source of truth when that fast path doesn't apply. Returns null on 404 (e.g.
 *  `before` was garbage-collected after a force-push), signalling the caller should fall
 *  back to a full tree re-scan instead. */
export async function compareCommits(
  installationId: string,
  owner: string,
  repo: string,
  base: string,
  head: string
): Promise<CompareResult | null> {
  const res = await githubFetch(installationId, `/repos/${owner}/${repo}/compare/${base}...${head}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`compareCommits failed (${res.status}): ${await res.text()}`)
  const data = (await res.json()) as {
    status: CompareResult["status"]
    files?: CompareResult["files"]
    total_commits: number
  }
  const files = data.files ?? []
  // GitHub doesn't set an explicit truncation flag on compare like it does on trees —
  // the documented cap is 300 files in the `files` array regardless of how many
  // actually changed, so hitting exactly that count is the signal to distrust it.
  return { status: data.status, files, truncated: files.length >= 300 }
}

export function blobUrl(owner: string, repo: string, ref: string, path: string): string {
  return `https://github.com/${owner}/${repo}/blob/${ref}/${path}`
}

export function isMarkdownPath(path: string): boolean {
  return /\.(md|mdx)$/i.test(path)
}
