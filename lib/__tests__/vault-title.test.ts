import { describe, it, expect } from "vitest"
import {
  deriveTitle,
  deriveFilenameFromTitle,
  extractHeadings,
  titleFromFilename,
  cleanHeadingText,
  UNTITLED,
} from "@/lib/vault/title"

describe("extractHeadings", () => {
  it("finds ATX headings with their levels", () => {
    expect(extractHeadings("# One\n## Two\n### Three")).toEqual([
      { level: 1, text: "One" },
      { level: 2, text: "Two" },
      { level: 3, text: "Three" },
    ])
  })

  it("ignores headings inside a backtick fenced code block", () => {
    const doc = "intro\n\n```bash\n# not a heading\n```\n\n# Real Heading\n"
    expect(extractHeadings(doc)).toEqual([{ level: 1, text: "Real Heading" }])
  })

  it("ignores headings inside a tilde fenced code block", () => {
    const doc = "~~~\n# nope\n~~~\n# Yes\n"
    expect(extractHeadings(doc)).toEqual([{ level: 1, text: "Yes" }])
  })

  it("does not close a backtick fence with a tilde fence", () => {
    const doc = "```\n# hidden\n~~~\n# also hidden\n```\n# Visible\n"
    expect(extractHeadings(doc)).toEqual([{ level: 1, text: "Visible" }])
  })

  it("requires whitespace after the # run", () => {
    expect(extractHeadings("#NoSpace\n# Yes Space")).toEqual([
      { level: 1, text: "Yes Space" },
    ])
  })

  it("trims a closing run of hashes", () => {
    expect(extractHeadings("## Title ##")).toEqual([{ level: 2, text: "Title" }])
  })

  it("reads setext h1 and h2", () => {
    expect(extractHeadings("Title\n=====\n\nSub\n---")).toEqual([
      { level: 1, text: "Title" },
      { level: 2, text: "Sub" },
    ])
  })

  it("respects the maxLines window", () => {
    const doc = "x\n".repeat(60) + "# Late\n"
    expect(extractHeadings(doc, 50)).toEqual([])
  })

  it("returns an empty array for a document with no headings", () => {
    expect(extractHeadings("just prose\nmore prose")).toEqual([])
  })
})

describe("cleanHeadingText", () => {
  it("strips bold, italic, code and strikethrough", () => {
    expect(cleanHeadingText("**Bold** and *em* and `code` and ~~gone~~")).toBe(
      "Bold and em and code and gone"
    )
  })

  it("reduces a link to its label", () => {
    expect(cleanHeadingText("See [the docs](https://example.com)")).toBe("See the docs")
  })

  it("collapses whitespace", () => {
    expect(cleanHeadingText("  a   b \t c  ")).toBe("a b c")
  })

  it("caps length at 200 chars", () => {
    expect(cleanHeadingText("x".repeat(300))).toHaveLength(200)
  })
})

describe("titleFromFilename", () => {
  it("drops the extension and swaps separators for spaces", () => {
    expect(titleFromFilename("kubernetes-notes.md")).toBe("kubernetes notes")
    expect(titleFromFilename("my_deep_thoughts.markdown")).toBe("my deep thoughts")
  })

  it("does not Title Case", () => {
    expect(titleFromFilename("pricing-research.md")).toBe("pricing research")
  })

  it("strips a leading directory path", () => {
    expect(titleFromFilename("Vault/Clients/acme-kickoff.md")).toBe("acme kickoff")
  })

  it("returns an empty string for a bare extension", () => {
    expect(titleFromFilename(".md")).toBe("")
  })
})

describe("deriveTitle", () => {
  it("prefers the frontmatter title above all else", () => {
    expect(
      deriveTitle({ frontmatterTitle: "From Frontmatter", body: "# From H1", filename: "f.md" })
    ).toBe("From Frontmatter")
  })

  it("takes the first array entry when frontmatter title is a list", () => {
    expect(deriveTitle({ frontmatterTitle: ["A", "B"], body: "", filename: "f.md" })).toBe("A")
  })

  it("falls through a blank frontmatter title to the H1", () => {
    expect(deriveTitle({ frontmatterTitle: "   ", body: "# From H1", filename: "f.md" })).toBe(
      "From H1"
    )
  })

  it("uses the first H1, not a later one", () => {
    expect(deriveTitle({ body: "# First\n\n# Second", filename: "f.md" })).toBe("First")
  })

  it("skips an H2 in favour of the filename when there is no H1", () => {
    expect(deriveTitle({ body: "## Only an H2", filename: "the-file.md" })).toBe("the file")
  })

  it("ignores an H1 hidden in a code fence", () => {
    expect(
      deriveTitle({ body: "```\n# fake\n```\n", filename: "real-name.md" })
    ).toBe("real name")
  })

  it("ignores an H1 far into the document", () => {
    const body = "prose\n".repeat(60) + "# Too Late"
    expect(deriveTitle({ body, filename: "fallback-name.md" })).toBe("fallback name")
  })

  it("falls back to UNTITLED when everything is empty", () => {
    expect(deriveTitle({ body: "", filename: null })).toBe(UNTITLED)
    expect(deriveTitle({ body: "   ", filename: ".md" })).toBe(UNTITLED)
  })
})

describe("deriveFilenameFromTitle", () => {
  it("slugifies a title into a .md filename", () => {
    expect(deriveFilenameFromTitle("Q3 Pricing Notes!")).toBe("q3-pricing-notes.md")
  })

  it("falls back to untitled.md for a title with no alphanumerics", () => {
    expect(deriveFilenameFromTitle("!!!")).toBe("untitled.md")
  })

  it("caps length so a very long title doesn't produce an unbounded filename", () => {
    const long = "a".repeat(500)
    expect(deriveFilenameFromTitle(long).length).toBeLessThanOrEqual(63) // 60 + ".md"
  })
})
