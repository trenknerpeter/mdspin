import { describe, it, expect } from "vitest"
import { planIngest, type HashedIngestFile } from "@/lib/vault/plan"

const file = (overrides: Partial<HashedIngestFile>): HashedIngestFile => ({
  filename: "note.md",
  relativePath: null,
  text: "# Title\n\nbody\n",
  hash: null,
  ...overrides,
})

describe("planIngest", () => {
  it("skips files inside ignored directories (folder import junk)", () => {
    const plan = planIngest(
      [
        file({ filename: "workspace.json", relativePath: "Vault/.obsidian/workspace.json" }),
        file({ filename: "kickoff.md", relativePath: "Vault/Clients/kickoff.md" }),
      ],
      { mode: "top-folder-project" },
      new Set()
    )
    expect(plan.readyDocs).toHaveLength(1)
    expect(plan.readyDocs[0].row.filename).toBe("kickoff.md")
    expect(plan.outcome.skipped.ignored_path).toBe(1)
  })

  it("skips non-markdown files by extension, even outside an ignored path", () => {
    const plan = planIngest(
      [file({ filename: "photo.png", relativePath: "Vault/Clients/photo.png" })],
      { mode: "top-folder-project" },
      new Set()
    )
    expect(plan.readyDocs).toHaveLength(0)
    expect(plan.outcome.skipped.unsupported_type).toBe(1)
  })

  it("accepts every extension in INGEST_EXTS", () => {
    const plan = planIngest(
      [
        file({ filename: "a.md" }),
        file({ filename: "b.markdown" }),
        file({ filename: "c.mdx" }),
        file({ filename: "d.txt" }),
      ],
      { mode: "top-folder-project" },
      new Set()
    )
    expect(plan.readyDocs).toHaveLength(4)
    expect(plan.outcome.totalSkipped).toBe(0)
  })

  it("still applies buildIngestDoc's own skip rules (too_large, empty)", () => {
    const plan = planIngest(
      [file({ filename: "empty.md", text: "\n\n" })],
      { mode: "top-folder-project" },
      new Set()
    )
    expect(plan.readyDocs).toHaveLength(0)
    expect(plan.outcome.skipped.empty).toBe(1)
  })

  it("skips a file whose hash is already in the vault", () => {
    const plan = planIngest(
      [file({ filename: "dup.md", hash: "abc123" })],
      { mode: "top-folder-project" },
      new Set(["abc123"])
    )
    expect(plan.readyDocs).toHaveLength(0)
    expect(plan.outcome.skipped.already_in_vault).toBe(1)
  })

  it("dedupes matching hashes within the same batch", () => {
    const plan = planIngest(
      [
        file({ filename: "a.md", hash: "same" }),
        file({ filename: "b.md", hash: "same" }),
      ],
      { mode: "top-folder-project" },
      new Set()
    )
    expect(plan.readyDocs).toHaveLength(1)
    expect(plan.outcome.skipped.duplicate_in_batch).toBe(1)
  })

  it("passes settings through to buildIngestDoc (default tags, folder mapping)", () => {
    const plan = planIngest(
      [file({ filename: "k.md", relativePath: "Vault/Clients/Acme/k.md" })],
      { mode: "top-folder-project", defaultTags: ["manual"] },
      new Set()
    )
    expect(plan.readyDocs[0].projectNames).toEqual(["Clients"])
    expect(plan.readyDocs[0].row.tags).toEqual(["acme", "manual"])
  })

  it("is a no-op for an empty file list", () => {
    const plan = planIngest([], { mode: "top-folder-project" }, new Set())
    expect(plan.readyDocs).toHaveLength(0)
    expect(plan.outcome.totalSkipped).toBe(0)
  })
})
