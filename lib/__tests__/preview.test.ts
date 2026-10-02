import { describe, it, expect } from "vitest"
import { buildPreview, gateForGuest, countWords, PREVIEW_MARKER } from "@/lib/preview"

const para = (n: number, words = 40) =>
  Array.from({ length: words }, (_, i) => `p${n}w${i}`).join(" ")
const longDoc = Array.from({ length: 30 }, (_, i) => para(i)).join("\n\n")

describe("buildPreview", () => {
  it("returns nothing to hide for an empty document", () => {
    expect(buildPreview("   ")).toEqual({ preview: "", truncated: false, totalWords: 0 })
  })

  it("truncates a long document and ends with the marker", () => {
    const r = buildPreview(longDoc)
    expect(r.truncated).toBe(true)
    expect(r.preview.trimEnd().endsWith(PREVIEW_MARKER)).toBe(true)
    expect(r.preview.length).toBeLessThanOrEqual(1200 + PREVIEW_MARKER.length + 10)
  })

  it("never leaks the end of the document", () => {
    const r = buildPreview(longDoc)
    expect(r.preview).not.toContain(para(29))
    expect(r.preview).not.toContain("p29w0")
  })

  it("cuts on a paragraph boundary, not mid-paragraph", () => {
    const r = buildPreview(longDoc)
    const head = r.preview.split("\n\n…\n\n")[0]
    expect(head.endsWith("w39")).toBe(true) // last word of a full paragraph
  })

  it("shows at most 40% of a short document", () => {
    const short = [para(0, 20), para(1, 20), para(2, 20), para(3, 20), para(4, 20)].join("\n\n")
    const r = buildPreview(short)
    const head = r.preview.split("\n\n…\n\n")[0]
    expect(head.length).toBeLessThanOrEqual(Math.floor(short.length * 0.4))
    expect(r.preview).not.toContain("p4w0")
  })

  it("hard-cuts text with no whitespace", () => {
    const blob = "x".repeat(5000)
    const head = buildPreview(blob).preview.split("\n\n…\n\n")[0]
    expect(head.length).toBe(1200)
  })

  it("reports the full document's word count", () => {
    expect(buildPreview(longDoc).totalWords).toBe(countWords(longDoc))
    expect(countWords(longDoc)).toBe(1200)
  })
})

describe("gateForGuest", () => {
  it("replaces markdown with the preview and adds metadata", () => {
    const out = gateForGuest({ success: true, markdown_text: longDoc, filename: "a.pdf", index: 0 })
    expect(out.markdown_text).not.toBe(longDoc)
    expect(out.preview).toEqual({ truncated: true, total_words: 1200 })
    expect(out.filename).toBe("a.pdf")
    expect(out.index).toBe(0)
  })

  it("drops fields that are not whitelisted (they could carry the full text)", () => {
    const out = gateForGuest({ success: true, markdown_text: longDoc, chunks: [longDoc], raw: longDoc })
    expect(out).not.toHaveProperty("chunks")
    expect(out).not.toHaveProperty("raw")
  })

  it("passes failures through without a preview", () => {
    const out = gateForGuest({ success: false, error: "UNSUPPORTED", message: "nope" })
    expect(out).toEqual({ success: false, error: "UNSUPPORTED", message: "nope" })
  })

  it("never leaks markdown_text on failure (success: false)", () => {
    const out = gateForGuest({ success: false, markdown_text: longDoc, error: "X" })
    expect(out).not.toHaveProperty("markdown_text")
    expect(out).not.toHaveProperty("preview")
    expect(out.success).toBe(false)
    expect(out.error).toBe("X")
  })

  it("never leaks markdown_text when it is not a string", () => {
    const out = gateForGuest({ success: true, markdown_text: [longDoc] })
    expect(out).not.toHaveProperty("markdown_text")
    expect(out).not.toHaveProperty("preview")
    expect(out.success).toBe(true)
  })

  it("gates single-file responses that have no success flag", () => {
    const out = gateForGuest({ markdown_text: longDoc, file_type: "pdf" })
    expect(out.preview).toEqual({ truncated: true, total_words: 1200 })
    expect(out.file_type).toBe("pdf")
  })
})
