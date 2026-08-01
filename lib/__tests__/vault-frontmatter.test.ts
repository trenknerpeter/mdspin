import { describe, it, expect } from "vitest"
import { splitFrontmatter, parseSimpleYaml } from "@/lib/vault/frontmatter"

describe("splitFrontmatter", () => {
  it("returns the whole document as body when there is no fence", () => {
    const r = splitFrontmatter("# Hello\n\nbody")
    expect(r.raw).toBeNull()
    expect(r.data).toEqual({})
    expect(r.body).toBe("# Hello\n\nbody")
  })

  it("parses a simple fence and strips it from the body", () => {
    const r = splitFrontmatter("---\ntitle: Hi\n---\n# Body\n")
    expect(r.data).toEqual({ title: "Hi" })
    expect(r.body).toBe("# Body\n")
  })

  it("only treats a fence at the very start as frontmatter", () => {
    // The classic bug: a `---` horizontal rule mid-document being mistaken for a fence.
    const doc = "Intro paragraph\n\n---\n\nSecond section\n"
    const r = splitFrontmatter(doc)
    expect(r.raw).toBeNull()
    expect(r.body).toBe(doc)
  })

  it("does not mis-split a document whose body contains a later --- rule", () => {
    const r = splitFrontmatter("---\ntitle: A\n---\nfirst\n\n---\n\nsecond\n")
    expect(r.data).toEqual({ title: "A" })
    expect(r.body).toBe("first\n\n---\n\nsecond\n")
  })

  it("treats an opening fence with no closing fence as body", () => {
    const doc = "---\nthis is not really frontmatter\n"
    const r = splitFrontmatter(doc)
    expect(r.raw).toBeNull()
    expect(r.body).toBe(doc)
  })

  it("handles CRLF line endings", () => {
    const r = splitFrontmatter("---\r\ntitle: Hi\r\n---\r\nbody\r\n")
    expect(r.data).toEqual({ title: "Hi" })
    expect(r.body).toBe("body\r\n")
  })

  it("handles an empty frontmatter block", () => {
    const r = splitFrontmatter("---\n---\nbody")
    expect(r.data).toEqual({})
    expect(r.raw).toBe("")
    expect(r.body).toBe("body")
  })

  it("accepts ... as a terminator", () => {
    const r = splitFrontmatter("---\ntitle: Hi\n...\nbody")
    expect(r.data).toEqual({ title: "Hi" })
    expect(r.body).toBe("body")
  })

  it("strips a UTF-8 BOM before matching the fence", () => {
    const r = splitFrontmatter("﻿---\ntitle: Hi\n---\nbody")
    expect(r.data).toEqual({ title: "Hi" })
    expect(r.body).toBe("body")
  })

  it("preserves the body byte-for-byte", () => {
    const body = "line1\n\n  indented\n\ttabbed\n\n"
    const r = splitFrontmatter(`---\ntitle: X\n---\n${body}`)
    expect(r.body).toBe(body)
  })

  it("never throws on YAML it cannot model, and still yields the body", () => {
    const r = splitFrontmatter("---\nnested:\n  deep:\n    a: 1\n---\nbody\n")
    expect(r.body).toBe("body\n")
    expect(r.raw).toContain("nested:")
    // Importing must proceed even though the shape wasn't understood.
    expect(typeof r.data).toBe("object")
  })
})

describe("parseSimpleYaml", () => {
  it("parses scalars and strips quotes", () => {
    expect(parseSimpleYaml('a: 1\nb: "two"\nc: \'three\'')).toEqual({
      a: "1",
      b: "two",
      c: "three",
    })
  })

  it("parses a flow list", () => {
    expect(parseSimpleYaml("tags: [alpha, beta]")).toEqual({ tags: ["alpha", "beta"] })
  })

  it("parses an empty flow list", () => {
    expect(parseSimpleYaml("tags: []")).toEqual({ tags: [] })
  })

  it("parses a block list", () => {
    expect(parseSimpleYaml("tags:\n  - alpha\n  - beta")).toEqual({
      tags: ["alpha", "beta"],
    })
  })

  it("keeps a comma-separated string as a string (tag splitting is the caller's job)", () => {
    expect(parseSimpleYaml("tags: alpha, beta")).toEqual({ tags: "alpha, beta" })
  })

  it("drops whole-line comments", () => {
    expect(parseSimpleYaml("# a comment\ntitle: Hi")).toEqual({ title: "Hi" })
  })

  it("drops an unquoted trailing comment", () => {
    expect(parseSimpleYaml("title: Hi # trailing")).toEqual({ title: "Hi" })
  })

  it("keeps a # that is inside quotes", () => {
    expect(parseSimpleYaml('title: "C# notes"')).toEqual({ title: "C# notes" })
  })

  it("keeps a # that is not preceded by whitespace", () => {
    expect(parseSimpleYaml("tag: cool#stuff")).toEqual({ tag: "cool#stuff" })
  })

  it("allows keys containing dots, dashes and spaces", () => {
    expect(parseSimpleYaml("created-at: x\nmy key: y")).toEqual({
      "created-at": "x",
      "my key": "y",
    })
  })

  it("tolerates a value containing a colon", () => {
    expect(parseSimpleYaml("title: Notes: part two")).toEqual({ title: "Notes: part two" })
  })

  it("returns an empty object for empty input", () => {
    expect(parseSimpleYaml("")).toEqual({})
  })
})
