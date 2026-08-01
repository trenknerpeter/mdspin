import { describe, it, expect } from "vitest"
import {
  buildIngestDoc,
  dedupeWithinBatch,
  summarizeIngestOutcome,
  normalizeProjectNames,
  type IngestDoc,
} from "@/lib/vault/ingest"
import { MAX_DOC_CHARS } from "@/lib/vault/limits"

const build = (
  text: string,
  filename = "note.md",
  relativePath: string | null = null,
  opts: Partial<Parameters<typeof buildIngestDoc>[1]> = {}
) => buildIngestDoc({ filename, relativePath, text }, { mode: "top-folder-project", ...opts })

const ok = (r: ReturnType<typeof buildIngestDoc>) => {
  if (!("doc" in r)) throw new Error(`expected a doc, got skip: ${(r as { skip: string }).skip}`)
  return r.doc
}

describe("buildIngestDoc", () => {
  it("produces the expected insert-row shape", () => {
    const doc = ok(build("# Hello\n\nbody text here\n", "hello.md"))
    expect(doc.row).toEqual({
      filename: "hello.md",
      file_type: "md",
      title: "Hello",
      markdown_text: "# Hello\n\nbody text here\n",
      word_count: 5,
      tags: [],
      in_vault: true,
      source_type: "upload",
      source_path: null,
      source_created_at: null,
      frontmatter: null,
      content_hash: null,
      summary: null,
      summary_status: "pending",
    })
  })

  it("never emits a project_id key — membership is array-shaped from day one", () => {
    const doc = ok(build("# x\n"))
    expect(doc.row).not.toHaveProperty("project_id")
    expect(Array.isArray(doc.projectNames)).toBe(true)
  })

  it("always resolves filename and file_type, which are NOT NULL in the DB", () => {
    const doc = ok(build("body", ""))
    expect(doc.row.filename).toBe("untitled.md")
    expect(doc.row.file_type).toBe("md")
  })

  it("strips frontmatter from markdown_text but keeps unknown keys in frontmatter jsonb", () => {
    const doc = ok(build("---\ntitle: T\nweird: value\n---\nbody\n"))
    expect(doc.row.markdown_text).toBe("body\n")
    expect(doc.row.title).toBe("T")
    expect(doc.row.frontmatter).toEqual({ weird: "value" })
  })

  it("does not put recognised keys into the frontmatter jsonb", () => {
    const doc = ok(build("---\ntitle: T\ntags: [a]\nsummary: S\n---\nbody\n"))
    expect(doc.row.frontmatter).toBeNull()
  })

  it("puts a frontmatter date in source_created_at and NOT converted_at", () => {
    const doc = ok(build("---\ndate: 2019-03-04\n---\nbody\n"))
    expect(doc.row.source_created_at).toBe(new Date("2019-03-04").toISOString())
    expect(doc.row).not.toHaveProperty("converted_at")
  })

  it("ignores an unparseable frontmatter date rather than failing", () => {
    expect(ok(build("---\ndate: someday\n---\nbody\n")).row.source_created_at).toBeNull()
  })

  it("marks a frontmatter summary as manual so the Make drainer skips it", () => {
    const doc = ok(build("---\nsummary: Already summarised\n---\nbody\n"))
    expect(doc.row.summary).toBe("Already summarised")
    expect(doc.row.summary_status).toBe("manual")
  })

  it("accepts description and excerpt as summary aliases", () => {
    expect(ok(build("---\ndescription: D\n---\nb\n")).row.summary_status).toBe("manual")
    expect(ok(build("---\nexcerpt: E\n---\nb\n")).row.summary_status).toBe("manual")
  })

  it("caps a long frontmatter summary", () => {
    const doc = ok(build(`---\nsummary: ${"x".repeat(900)}\n---\nb\n`))
    expect(doc.row.summary).toHaveLength(400)
  })

  it("merges frontmatter tags, path tags and default tags", () => {
    const doc = ok(
      build("---\ntags: [alpha]\n---\nb\n", "k.md", "Root/Proj/Deep/k.md", {
        defaultTags: ["manual"],
      })
    )
    expect(doc.row.tags).toEqual(["alpha", "deep", "manual"])
  })

  it("derives the project from the top folder", () => {
    const doc = ok(build("b\n", "k.md", "Root/Clients/Acme/k.md"))
    expect(doc.projectNames).toEqual(["Clients"])
  })

  it("lets a frontmatter project override folder inference", () => {
    const doc = ok(build("---\nproject: Explicit\n---\nb\n", "k.md", "Root/Clients/k.md"))
    expect(doc.projectNames).toEqual(["Explicit"])
  })

  it("appends default project names", () => {
    const doc = ok(
      build("b\n", "k.md", "Root/Clients/k.md", { defaultProjectNames: ["Inbox"] })
    )
    expect(doc.projectNames).toEqual(["Clients", "Inbox"])
  })

  it("honours the source_type override", () => {
    expect(ok(build("b", "n.md", null, { sourceType: "note" })).row.source_type).toBe("note")
  })

  it("skips a document over the size cap", () => {
    const r = build("x".repeat(MAX_DOC_CHARS + 1))
    expect(r).toEqual({ skip: "too_large" })
  })

  it("skips an empty or whitespace-only document", () => {
    expect(build("")).toEqual({ skip: "empty" })
    expect(build("\n\n   \n")).toEqual({ skip: "empty" })
    // Frontmatter alone is not content.
    expect(build("---\ntitle: T\n---\n")).toEqual({ skip: "empty" })
  })

  it("drops an oversized frontmatter jsonb rather than storing it", () => {
    const doc = ok(build(`---\nbig: ${"y".repeat(20_000)}\n---\nbody\n`))
    expect(doc.row.frontmatter).toBeNull()
    expect(doc.row.markdown_text).toBe("body\n")
  })
})

describe("dedupeWithinBatch", () => {
  const withHash = (hash: string | null, filename: string): IngestDoc => {
    const doc = ok(build(`# ${filename}\n`, filename))
    doc.row.content_hash = hash
    return doc
  }

  it("keeps the first occurrence and reports the rest", () => {
    const r = dedupeWithinBatch([
      withHash("h1", "a.md"),
      withHash("h1", "b.md"),
      withHash("h2", "c.md"),
    ])
    expect(r.kept.map((d) => d.row.filename)).toEqual(["a.md", "c.md"])
    expect(r.skipped).toHaveLength(1)
    expect(r.skipped[0]).toMatchObject({ filename: "b.md", reason: "duplicate_in_batch" })
  })

  it("never treats null hashes as duplicates of one another", () => {
    // A null hash means we could not compute one, not that the content matched.
    const r = dedupeWithinBatch([withHash(null, "a.md"), withHash(null, "b.md")])
    expect(r.kept).toHaveLength(2)
    expect(r.skipped).toHaveLength(0)
  })

  it("is a no-op for an empty batch", () => {
    expect(dedupeWithinBatch([])).toEqual({ kept: [], skipped: [] })
  })
})

describe("normalizeProjectNames", () => {
  it("de-duplicates case-insensitively, keeping first-seen casing", () => {
    expect(normalizeProjectNames(["Clients", "clients", " CLIENTS "])).toEqual(["Clients"])
  })

  it("drops blanks", () => {
    expect(normalizeProjectNames(["", "  ", "A"])).toEqual(["A"])
  })
})

describe("summarizeIngestOutcome", () => {
  it("counts each reason and the total", () => {
    const out = summarizeIngestOutcome(10, [
      { filename: "a", relativePath: null, title: "a", reason: "too_large" },
      { filename: "b", relativePath: null, title: "b", reason: "duplicate_in_batch" },
      { filename: "c", relativePath: null, title: "c", reason: "duplicate_in_batch" },
    ])
    expect(out.ready).toBe(10)
    expect(out.totalSkipped).toBe(3)
    expect(out.skipped.duplicate_in_batch).toBe(2)
    expect(out.skipped.too_large).toBe(1)
    expect(out.skipped.already_in_vault).toBe(0)
  })

  it("reports zeroes for an empty skip list", () => {
    const out = summarizeIngestOutcome(0, [])
    expect(out.totalSkipped).toBe(0)
    expect(Object.values(out.skipped).every((n) => n === 0)).toBe(true)
  })
})
