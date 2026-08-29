import { describe, it, expect } from "vitest"
import { chunkMarkdownByHeading } from "@/lib/vault/chunking"

describe("chunkMarkdownByHeading", () => {
  it("strips embedded base64 image data before chunking, never embedding it", () => {
    const img = "![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQ)"
    const md = `# Notes\n\n${img}\n\nreal content that matters`
    const chunks = chunkMarkdownByHeading(md)
    expect(chunks).toHaveLength(1)
    expect(chunks[0].content).not.toContain("base64")
    expect(chunks[0].content).toContain("real content that matters")
  })

  it("never leaves base64 image data in a chunk even when a section is otherwise only an image", () => {
    const img = "![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQ)"
    const md = `# Screenshot\n\n${img}\n\n# Real Section\n\nactual text`
    const chunks = chunkMarkdownByHeading(md)
    // The heading line itself is still retained content (Task 4's established behavior —
    // a heading-only section still emits its own chunk), but the stripped image must never
    // appear anywhere in any chunk's content.
    expect(chunks.map((c) => c.headingPath)).toEqual(["Screenshot", "Real Section"])
    expect(chunks.every((c) => !c.content.includes("base64"))).toBe(true)
  })

  it("returns one chunk with a null headingPath for a document with no headings", () => {
    const chunks = chunkMarkdownByHeading("just some plain text, nothing else.")
    expect(chunks).toEqual([
      { headingPath: null, content: "just some plain text, nothing else.", tokenCount: 9 },
    ])
  })

  it("splits on headings and builds a nested breadcrumb path", () => {
    const md = [
      "# Setup",
      "top-level intro",
      "## Installation",
      "run npm install",
      "## Configuration",
      "edit the config file",
    ].join("\n")
    const chunks = chunkMarkdownByHeading(md)
    expect(chunks.map((c) => c.headingPath)).toEqual(["Setup", "Setup > Installation", "Setup > Configuration"])
    expect(chunks.map((c) => c.content)).toEqual([
      "# Setup\ntop-level intro",
      "## Installation\nrun npm install",
      "## Configuration\nedit the config file",
    ])
  })

  it("pops the breadcrumb stack back down for a sibling heading, not just nested ones", () => {
    const md = ["# A", "## A1", "text one", "# B", "text two"].join("\n")
    const chunks = chunkMarkdownByHeading(md)
    expect(chunks.map((c) => c.headingPath)).toEqual(["A", "A > A1", "B"])
  })

  it("never treats a heading-like line inside a fenced code block as a real heading", () => {
    const md = ["# Real Heading", "```", "# not a heading", "```", "body text"].join("\n")
    const chunks = chunkMarkdownByHeading(md)
    expect(chunks).toHaveLength(1)
    expect(chunks[0].headingPath).toBe("Real Heading")
    expect(chunks[0].content).toContain("# not a heading")
  })

  it("still emits a chunk for a heading-only section — its own heading line is retained content, never dropped", () => {
    const md = ["# Empty", "# Full", "content here"].join("\n")
    const chunks = chunkMarkdownByHeading(md)
    expect(chunks.map((c) => c.headingPath)).toEqual(["Empty", "Full"])
    expect(chunks[0].content).toBe("# Empty")
  })

  it("sub-splits an oversize section on paragraph boundaries, never mid-paragraph", () => {
    const para1 = "one ".repeat(300).trim() // ~300 tokens
    const para2 = "two ".repeat(300).trim() // ~300 tokens
    const md = `# Big\n\n${para1}\n\n${para2}`
    const chunks = chunkMarkdownByHeading(md, 400)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((c) => c.headingPath === "Big")).toBe(true)
    // Every original paragraph must appear whole in exactly one chunk — never cut.
    expect(chunks.some((c) => c.content.includes(para1))).toBe(true)
    expect(chunks.some((c) => c.content.includes(para2))).toBe(true)
  })

  it("gives a single paragraph larger than maxTokens its own chunk rather than dropping or cutting it", () => {
    const huge = "x ".repeat(1000).trim()
    const chunks = chunkMarkdownByHeading(huge, 100)
    expect(chunks).toHaveLength(1)
    expect(chunks[0].content).toBe(huge)
  })

  it("computes tokenCount via estimateTokenCount for every chunk", () => {
    const chunks = chunkMarkdownByHeading("abcd")
    expect(chunks[0].tokenCount).toBe(1)
  })

  it("returns an empty array for empty input", () => {
    expect(chunkMarkdownByHeading("")).toEqual([])
  })

  it("consumes the setext underline so a following divider/heading isn't misread as heading text", () => {
    const md = "Title\n=====\n---\nMore content"
    const chunks = chunkMarkdownByHeading(md)
    expect(chunks).toEqual([
      { headingPath: "Title", content: "Title\n=====\n---\nMore content", tokenCount: 7 },
    ])
  })
})
