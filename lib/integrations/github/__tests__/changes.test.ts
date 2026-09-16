import { describe, it, expect } from "vitest"
import { resolvePush, branchFromRef, type GitHubPushPayload } from "../changes"

function push(overrides: Partial<GitHubPushPayload>): GitHubPushPayload {
  return {
    ref: "refs/heads/main",
    before: "aaa",
    after: "bbb",
    created: false,
    deleted: false,
    forced: false,
    size: 1,
    commits: [],
    ...overrides,
  }
}

describe("branchFromRef", () => {
  it("extracts the branch name from a heads ref", () => {
    expect(branchFromRef("refs/heads/main")).toBe("main")
    expect(branchFromRef("refs/heads/feature/x")).toBe("feature/x")
  })
  it("returns null for a tag ref", () => {
    expect(branchFromRef("refs/tags/v1.0.0")).toBeNull()
  })
})

describe("resolvePush", () => {
  it("ignores a push to an untracked branch", () => {
    const result = resolvePush(push({ ref: "refs/heads/other" }), "main")
    expect(result).toEqual({ kind: "ignored_branch" })
  })

  it("flags branch deletion", () => {
    const result = resolvePush(push({ deleted: true, after: "0".repeat(40) }), "main")
    expect(result).toEqual({ kind: "branch_deleted" })
  })

  it("falls back to full_rescan when the branch was just created — there's no diff base", () => {
    const result = resolvePush(push({ created: true, before: "0".repeat(40) }), "main")
    expect(result).toEqual({ kind: "full_rescan", reason: "created" })
  })

  it("falls back to needs_compare on a force-push", () => {
    const result = resolvePush(push({ forced: true }), "main")
    expect(result).toEqual({ kind: "needs_compare", base: "aaa", head: "bbb" })
  })

  it("falls back to needs_compare when commits[] was truncated (size > commits.length)", () => {
    // GitHub caps the commits array at 20 regardless of how many commits the push had.
    const result = resolvePush(
      push({ size: 25, commits: Array.from({ length: 20 }, () => ({ added: [], modified: [], removed: [] })) }),
      "main"
    )
    expect(result).toEqual({ kind: "needs_compare", base: "aaa", head: "bbb" })
  })

  it("uses the fast path for a normal push and aggregates added/modified/removed across commits", () => {
    const result = resolvePush(
      push({
        size: 2,
        commits: [
          { added: ["a.md"], modified: [], removed: [] },
          { added: [], modified: ["b.md"], removed: ["c.md"] },
        ],
      }),
      "main"
    )
    expect(result).toEqual({ kind: "fast_path", added: ["a.md"], modified: ["b.md"], removed: ["c.md"] })
  })

  it("nets a path added then removed within the same push to 'removed', not both", () => {
    const result = resolvePush(
      push({
        size: 2,
        commits: [
          { added: ["x.md"], modified: [], removed: [] },
          { added: [], modified: [], removed: ["x.md"] },
        ],
      }),
      "main"
    )
    expect(result.kind).toBe("fast_path")
    if (result.kind === "fast_path") {
      expect(result.added).not.toContain("x.md")
      expect(result.removed).toContain("x.md")
    }
  })

  it("nets a path removed then re-added within the same push to 'added', not 'modified'", () => {
    const result = resolvePush(
      push({
        size: 2,
        commits: [
          { added: [], modified: [], removed: ["y.md"] },
          { added: ["y.md"], modified: [], removed: [] },
        ],
      }),
      "main"
    )
    expect(result.kind).toBe("fast_path")
    if (result.kind === "fast_path") {
      expect(result.added).toContain("y.md")
      expect(result.removed).not.toContain("y.md")
      expect(result.modified).not.toContain("y.md")
    }
  })
})
