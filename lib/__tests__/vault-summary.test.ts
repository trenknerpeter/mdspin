import { describe, it, expect } from "vitest"
import {
  assembleSummaryPayload,
  clampSummary,
  nextSummaryStatus,
  parseSummaryResponse,
  SUMMARY_DELIMITER,
} from "@/lib/vault/summary"

const doc = (over: Partial<Parameters<typeof assembleSummaryPayload>[0][0]> = {}) => ({
  id: "id-1",
  title: "Title",
  filename: "file.md",
  markdown_text: "body",
  ...over,
})

describe("assembleSummaryPayload", () => {
  it("maps id, title and markdown", () => {
    const p = assembleSummaryPayload([doc()])
    expect(p.docs).toEqual([{ id: "id-1", title: "Title", markdown: "body" }])
    expect(p.maxWords).toBe(40)
  })

  it("falls back to the filename when there is no title", () => {
    expect(assembleSummaryPayload([doc({ title: null })]).docs[0].title).toBe("file.md")
  })

  it("treats null markdown as empty rather than throwing", () => {
    expect(assembleSummaryPayload([doc({ markdown_text: null })]).docs[0].markdown).toBe("")
  })

  it("caps the body at capChars", () => {
    const p = assembleSummaryPayload([doc({ markdown_text: "x".repeat(500) })], { capChars: 100 })
    expect(p.docs[0].markdown).toHaveLength(100)
  })

  it("appends a heading outline when the body was truncated", () => {
    const body = "x".repeat(200) + "\n# Alpha\n## Beta\n"
    const p = assembleSummaryPayload([doc({ markdown_text: body })], { capChars: 50 })
    expect(p.docs[0].markdown).toContain("## Outline")
    expect(p.docs[0].markdown).toContain("- Alpha")
    expect(p.docs[0].markdown).toContain("- Beta")
  })

  it("does not append an outline when the body fits within the cap", () => {
    const p = assembleSummaryPayload([doc({ markdown_text: "# Alpha\nshort" })], {
      capChars: 5000,
    })
    expect(p.docs[0].markdown).not.toContain("## Outline")
  })

  it("does not append an empty outline for a truncated body with no headings", () => {
    const p = assembleSummaryPayload([doc({ markdown_text: "x".repeat(500) })], { capChars: 10 })
    expect(p.docs[0].markdown).not.toContain("## Outline")
  })

  it("honours a maxWords override", () => {
    expect(assembleSummaryPayload([doc()], { maxWords: 25 }).maxWords).toBe(25)
  })

  it("handles an empty batch", () => {
    expect(assembleSummaryPayload([]).docs).toEqual([])
  })
})

describe("clampSummary", () => {
  it("returns null for empty input", () => {
    expect(clampSummary(null)).toBeNull()
    expect(clampSummary(undefined)).toBeNull()
    expect(clampSummary("   ")).toBeNull()
  })

  it("collapses whitespace", () => {
    expect(clampSummary("a\n\n  b")).toBe("a b")
  })

  it("leaves a short summary untouched", () => {
    expect(clampSummary("Short one.")).toBe("Short one.")
  })

  it("truncates on a word boundary and adds an ellipsis", () => {
    const out = clampSummary("alpha beta gamma delta", 16)!
    expect(out.endsWith("…")).toBe(true)
    expect(out.length).toBeLessThanOrEqual(16)
    expect(out).not.toContain("gamm…")
  })

  it("hard-cuts when there is no usable word boundary", () => {
    const out = clampSummary("x".repeat(50), 10)!
    expect(out).toHaveLength(10)
    expect(out.endsWith("…")).toBe(true)
  })

  it("defaults to a 400 char cap", () => {
    expect(clampSummary("word ".repeat(200))!.length).toBeLessThanOrEqual(400)
  })
})

describe("nextSummaryStatus", () => {
  it("is ready on success regardless of attempt count", () => {
    expect(nextSummaryStatus(1, true)).toBe("ready")
    expect(nextSummaryStatus(9, true)).toBe("ready")
  })

  it("stays pending while attempts remain", () => {
    expect(nextSummaryStatus(1, false)).toBe("pending")
    expect(nextSummaryStatus(2, false)).toBe("pending")
  })

  it("gives up at the attempt ceiling", () => {
    expect(nextSummaryStatus(3, false)).toBe("failed")
    expect(nextSummaryStatus(4, false)).toBe("failed")
  })
})

describe("parseSummaryResponse", () => {
  const ids = ["a", "b"]
  const delimited = (id: string, summary: string) => `${id}${SUMMARY_DELIMITER}${summary}`

  it("reads the delimited plain-text shape the Make scenario returns", () => {
    expect(parseSummaryResponse(delimited("a", "The summary."), ids)).toEqual({
      a: "The summary.",
    })
  })

  it("tolerates surrounding whitespace on the id", () => {
    expect(parseSummaryResponse(`  a  ${SUMMARY_DELIMITER}S`, ids)).toEqual({ a: "S" })
  })

  it("keeps a summary that itself contains quotes and backslashes", () => {
    const s = 'They said "no seats" (see C:\\billing\\old).'
    expect(parseSummaryResponse(delimited("a", s), ids)).toEqual({ a: s })
  })

  it("ignores a delimited response for an unrequested id", () => {
    expect(parseSummaryResponse(delimited("zzz", "S"), ids)).toEqual({})
  })

  // The regression this guard exists for. A Make filter that blocks a request still
  // answers 200 with the body "Accepted"; a tolerant parser would store that as a
  // document's summary. Verified against the live scenario.
  it("NEVER treats Make's blocked-request acknowledgement as a summary", () => {
    expect(parseSummaryResponse("Accepted", ["a"])).toEqual({})
    expect(parseSummaryResponse("Accepted", ids)).toEqual({})
  })

  it("rejects bare text with no delimiter, even for a single requested doc", () => {
    expect(parseSummaryResponse("just prose", ["a"])).toEqual({})
    expect(parseSummaryResponse("Scenario failed to complete.", ["a"])).toEqual({})
    expect(parseSummaryResponse("<html>502 Bad Gateway</html>", ["a"])).toEqual({})
  })

  it("reads the { summaries: [...] } shape, for a future batched scenario", () => {
    expect(parseSummaryResponse({ summaries: [{ id: "a", summary: "S" }] }, ids)).toEqual({
      a: "S",
    })
  })

  it("reads a bare array", () => {
    expect(parseSummaryResponse([{ id: "b", summary: "T" }], ids)).toEqual({ b: "T" })
  })

  it("reads a JSON string body", () => {
    expect(parseSummaryResponse('{"summaries":[{"id":"a","summary":"S"}]}', ids)).toEqual({
      a: "S",
    })
  })

  it("reads the single-doc { summary } shape", () => {
    // Safe despite being id-less: "Accepted" is not valid JSON, so it cannot reach here.
    expect(parseSummaryResponse({ summary: "S" }, ["a"])).toEqual({ a: "S" })
    // Ambiguous with two ids requested — refuse rather than guess.
    expect(parseSummaryResponse({ summary: "S" }, ids)).toEqual({})
  })

  it("ignores ids that were not requested", () => {
    // Guards against a misconfigured scenario writing a summary onto someone else's doc.
    expect(parseSummaryResponse({ summaries: [{ id: "zzz", summary: "S" }] }, ids)).toEqual({})
  })

  it("clamps returned summaries", () => {
    const out = parseSummaryResponse({ summaries: [{ id: "a", summary: "x".repeat(900) }] }, ids)
    expect(out.a.length).toBeLessThanOrEqual(400)
  })

  it("skips malformed entries without throwing", () => {
    expect(
      parseSummaryResponse({ summaries: [null, 5, { id: "a" }, { summary: "no id" }] }, ids)
    ).toEqual({})
  })

  it("returns an empty map for unusable bodies", () => {
    expect(parseSummaryResponse(null, ids)).toEqual({})
    expect(parseSummaryResponse(42, ids)).toEqual({})
  })
})
