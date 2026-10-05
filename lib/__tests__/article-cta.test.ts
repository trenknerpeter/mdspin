import { describe, it, expect } from "vitest"
import { splitBeforeNthH2, readArticleCta } from "../article-cta"

const ARTICLE =
  "<p>Intro.</p>\n<h2>First</h2>\n<p>One.</p>\n<h2>Second</h2>\n<p>Two.</p>\n<h2>Third</h2>\n<p>Three.</p>"

describe("splitBeforeNthH2", () => {
  it("cuts immediately before the nth heading", () => {
    const [before, after] = splitBeforeNthH2(ARTICLE, 2)
    expect(before).toBe("<p>Intro.</p>\n<h2>First</h2>\n<p>One.</p>\n")
    expect(after).toBe("<h2>Second</h2>\n<p>Two.</p>\n<h2>Third</h2>\n<p>Three.</p>")
  })

  it("rejoins to exactly the original, so no content is ever dropped", () => {
    for (const n of [1, 2, 3, 4, 9]) {
      const [a, b] = splitBeforeNthH2(ARTICLE, n)
      expect(a + b).toBe(ARTICLE)
    }
  })

  it("leaves the article whole when it has fewer headings than asked for", () => {
    expect(splitBeforeNthH2(ARTICLE, 4)).toEqual([ARTICLE, ""])
    expect(splitBeforeNthH2("<p>No headings at all.</p>", 2))
      .toEqual(["<p>No headings at all.</p>", ""])
  })

  it("handles headings that carry attributes", () => {
    const withAttrs = '<p>a</p><h2 id="one">One</h2><p>b</p><h2 class="x">Two</h2><p>c</p>'
    const [before, after] = splitBeforeNthH2(withAttrs, 2)
    expect(before).toBe('<p>a</p><h2 id="one">One</h2><p>b</p>')
    expect(after).toBe('<h2 class="x">Two</h2><p>c</p>')
  })

  it("is a no-op for a non-positive n", () => {
    expect(splitBeforeNthH2(ARTICLE, 0)).toEqual([ARTICLE, ""])
  })
})

describe("readArticleCta", () => {
  it("defaults to the second heading with no custom copy when frontmatter has no cta", () => {
    expect(readArticleCta(undefined)).toEqual({ section: 2 })
    expect(readArticleCta(null)).toEqual({ section: 2 })
  })

  it("reads a custom position and copy", () => {
    expect(
      readArticleCta({
        section: 4,
        prompt: "How many tokens would your file save?",
        action: "See my savings",
        heading: "See your own token savings",
        subheading: "Drop in a file.",
      }),
    ).toEqual({
      section: 4,
      prompt: "How many tokens would your file save?",
      action: "See my savings",
      heading: "See your own token savings",
      subheading: "Drop in a file.",
    })
  })

  it("ignores malformed values instead of breaking the page", () => {
    expect(readArticleCta({ section: "4", prompt: 7, heading: "" })).toEqual({ section: 2 })
    expect(readArticleCta({ section: 0 })).toEqual({ section: 2 })
    expect(readArticleCta({ section: 2.5 })).toEqual({ section: 2 })
    expect(readArticleCta("cta")).toEqual({ section: 2 })
  })
})
