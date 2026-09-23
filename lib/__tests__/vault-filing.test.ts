import { describe, it, expect } from "vitest"
import {
  assembleFilingPayload,
  findCandidateByName,
  matchProjectByPath,
  nextFilingStatusAfterFailure,
  parseFilingResponse,
  FILING_DELIMITER,
  type FilingCandidateProject,
} from "@/lib/vault/filing"

const candidates: FilingCandidateProject[] = [
  { id: "p1", name: "Acme Handbook" },
  { id: "p2", name: "Client Beta" },
]

describe("assembleFilingPayload", () => {
  it("maps id, title and markdown, and passes candidates through", () => {
    const doc = { id: "d1", title: "Title", filename: "file.md", markdown_text: "body" }
    const req = assembleFilingPayload(doc, candidates)
    expect(req.doc).toEqual({ id: "d1", title: "Title", markdown: "body" })
    expect(req.projects).toBe(candidates)
  })

  it("falls back to the filename when there is no title", () => {
    const doc = { id: "d1", title: null, filename: "file.md", markdown_text: "body" }
    expect(assembleFilingPayload(doc, candidates).doc.title).toBe("file.md")
  })

  it("treats null markdown as empty rather than throwing", () => {
    const doc = { id: "d1", title: "T", filename: "file.md", markdown_text: null }
    expect(assembleFilingPayload(doc, candidates).doc.markdown).toBe("")
  })

  it("caps the body at capChars", () => {
    const doc = { id: "d1", title: "T", filename: "file.md", markdown_text: "x".repeat(500) }
    expect(assembleFilingPayload(doc, candidates, { capChars: 100 }).doc.markdown).toHaveLength(100)
  })
})

describe("matchProjectByPath", () => {
  it("matches when the repo name equals a project name, ignoring case and punctuation", () => {
    const result = matchProjectByPath({ repoName: "acme-handbook", externalId: "notes.md" }, candidates)
    expect(result).toEqual({ projectId: "p1", confidence: 1, note: "Matched by repository name." })
  })

  it("matches when the doc's top folder equals a project name", () => {
    const result = matchProjectByPath({ repoName: "docs-repo", externalId: "client_beta/notes.md" }, candidates)
    expect(result).toEqual({ projectId: "p2", confidence: 0.95, note: "Matched by folder path." })
  })

  it("prefers the repo-name match over the folder match", () => {
    const result = matchProjectByPath(
      { repoName: "Acme Handbook", externalId: "client_beta/notes.md" },
      candidates
    )
    expect(result?.projectId).toBe("p1")
  })

  it("returns null when nothing matches — the common case, per the user's own read of most repos", () => {
    expect(matchProjectByPath({ repoName: "unrelated-repo", externalId: "misc/notes.md" }, candidates)).toBeNull()
  })

  it("returns null for a top-level file with no folder", () => {
    expect(matchProjectByPath({ repoName: "unrelated-repo", externalId: "readme.md" }, candidates)).toBeNull()
  })

  it("never fuzzy-matches a partial name — a false positive here silently misfiles a document", () => {
    const result = matchProjectByPath({ repoName: "acme-handbook-v2", externalId: "notes.md" }, candidates)
    expect(result).toBeNull()
  })
})

describe("parseFilingResponse", () => {
  const delimited = (id: string, json: unknown) => `${id}${FILING_DELIMITER}${JSON.stringify(json)}`

  it("reads a match decision naming a project", () => {
    const body = delimited("d1", { decision: "match", name: "Acme Handbook", confidence: 0.9 })
    expect(parseFilingResponse(body, "d1")).toEqual({
      decision: "match",
      name: "Acme Handbook",
      confidence: 0.9,
    })
  })

  it("reads a new-project decision", () => {
    const body = delimited("d1", { decision: "new", name: "Client Gamma", confidence: 0.92 })
    expect(parseFilingResponse(body, "d1")).toEqual({
      decision: "new",
      name: "Client Gamma",
      confidence: 0.92,
    })
  })

  it("reads a none decision", () => {
    const body = delimited("d1", { decision: "none", confidence: 0.2 })
    expect(parseFilingResponse(body, "d1")).toEqual({ decision: "none", confidence: 0.2 })
  })

  it("clamps an out-of-range confidence into [0,1]", () => {
    const body = delimited("d1", { decision: "none", confidence: 5 })
    expect(parseFilingResponse(body, "d1")).toEqual({ decision: "none", confidence: 1 })
  })

  // THE regression guard, mirroring parseSummaryResponse's identical one. A blocked Make
  // filter answers HTTP 200 with the literal body "Accepted" — no delimiter, so this must
  // never be mistaken for a decision.
  it("NEVER treats Make's blocked-request acknowledgement as a decision", () => {
    expect(parseFilingResponse("Accepted", "d1")).toBeNull()
  })

  it("rejects a response for a different document id", () => {
    const body = delimited("other-doc", { decision: "match", name: "Acme Handbook", confidence: 0.9 })
    expect(parseFilingResponse(body, "d1")).toBeNull()
  })

  it("rejects malformed JSON after the delimiter", () => {
    expect(parseFilingResponse(`d1${FILING_DELIMITER}not json`, "d1")).toBeNull()
  })

  it("rejects an unrecognised decision value", () => {
    const body = delimited("d1", { decision: "maybe", confidence: 0.9 })
    expect(parseFilingResponse(body, "d1")).toBeNull()
  })

  it("rejects a missing or non-numeric confidence", () => {
    const body = delimited("d1", { decision: "none" })
    expect(parseFilingResponse(body, "d1")).toBeNull()
  })

  it("rejects a match or new decision with an empty name", () => {
    expect(parseFilingResponse(delimited("d1", { decision: "match", name: "  ", confidence: 0.9 }), "d1")).toBeNull()
    expect(parseFilingResponse(delimited("d1", { decision: "new", name: "  ", confidence: 0.9 }), "d1")).toBeNull()
  })

  it("rejects bare text with no delimiter", () => {
    expect(parseFilingResponse("just prose", "d1")).toBeNull()
    expect(parseFilingResponse("<html>502 Bad Gateway</html>", "d1")).toBeNull()
  })

  it("returns null for unusable bodies", () => {
    expect(parseFilingResponse(null, "d1")).toBeNull()
    expect(parseFilingResponse(42, "d1")).toBeNull()
  })
})

describe("findCandidateByName", () => {
  it("resolves a name to its candidate, ignoring case and punctuation", () => {
    expect(findCandidateByName("acme handbook", candidates)).toEqual(candidates[0])
    expect(findCandidateByName("CLIENT-BETA", candidates)).toEqual(candidates[1])
  })

  it("returns null for a name that matches no candidate", () => {
    expect(findCandidateByName("Something Else", candidates)).toBeNull()
  })

  it("returns null for an empty name", () => {
    expect(findCandidateByName("   ", candidates)).toBeNull()
  })
})

describe("nextFilingStatusAfterFailure", () => {
  it("stays pending while attempts remain", () => {
    expect(nextFilingStatusAfterFailure(1)).toBe("pending")
    expect(nextFilingStatusAfterFailure(2)).toBe("pending")
  })

  it("gives up at the attempt ceiling", () => {
    expect(nextFilingStatusAfterFailure(3)).toBe("failed")
    expect(nextFilingStatusAfterFailure(4)).toBe("failed")
  })
})
