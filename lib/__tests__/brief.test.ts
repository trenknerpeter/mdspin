import { describe, it, expect } from "vitest"
import { parseBriefResponse } from "@/lib/brief"

describe("parseBriefResponse", () => {
  const realBrief =
    "### Summary\nA flat $9/month was chosen over per-seat billing after beta churn."

  it("accepts raw markdown", () => {
    expect(parseBriefResponse(realBrief)).toBe(realBrief)
  })

  it("accepts JSON { brief }", () => {
    expect(parseBriefResponse(JSON.stringify({ brief: realBrief }))).toBe(realBrief)
  })

  it("accepts a bare JSON string", () => {
    expect(parseBriefResponse(JSON.stringify(realBrief))).toBe(realBrief)
  })

  it("trims surrounding whitespace", () => {
    expect(parseBriefResponse(`\n\n${realBrief}\n\n`)).toBe(realBrief)
  })

  // The regression guard. Adding a shared-secret filter to Make scenario 6259002 means a
  // rejected request now returns 200 "Accepted"; without this the route would overwrite a
  // real brief with that string.
  it("NEVER treats Make's blocked-request acknowledgement as a brief", () => {
    expect(parseBriefResponse("Accepted")).toBeNull()
    expect(parseBriefResponse("accepted")).toBeNull()
    expect(parseBriefResponse("Accepted.")).toBeNull()
    expect(parseBriefResponse("  Accepted  ")).toBeNull()
  })

  it("rejects empty and whitespace-only bodies", () => {
    expect(parseBriefResponse("")).toBeNull()
    expect(parseBriefResponse("   \n ")).toBeNull()
  })

  it("rejects bodies too short to be a five-section brief", () => {
    expect(parseBriefResponse("Scenario failed.")).toBeNull()
    expect(parseBriefResponse("ok")).toBeNull()
  })

  it("keeps a brief that merely contains the word accepted", () => {
    const s = "### Summary\nThe proposal was accepted by the team after review in Q3."
    expect(parseBriefResponse(s)).toBe(s)
  })
})
import { assembleClusterPayload, CLUSTER_DOC_CAP, type ClusterDoc } from "@/lib/brief"

const src: ClusterDoc = { title: "Acme Q3 Pricing", filename: "acme.pdf", markdown_text: "pricing body" }
const rel: ClusterDoc = { title: "Acme Renewal", filename: "renew.docx", markdown_text: "renewal body" }

describe("assembleClusterPayload", () => {
  it("puts the source doc first, then related", () => {
    const out = assembleClusterPayload(src, [rel])
    expect(out.docs.map((d) => d.title)).toEqual(["Acme Q3 Pricing", "Acme Renewal"])
  })

  it("sets topic from the source title", () => {
    expect(assembleClusterPayload(src, []).topic).toBe("Acme Q3 Pricing")
  })

  it("falls back to filename when title is null", () => {
    const out = assembleClusterPayload({ ...src, title: null }, [])
    expect(out.topic).toBe("acme.pdf")
    expect(out.docs[0].title).toBe("acme.pdf")
  })

  it("caps each doc's markdown at capChars", () => {
    const big: ClusterDoc = { title: "Big", filename: "b.md", markdown_text: "x".repeat(10000) }
    const out = assembleClusterPayload(big, [], 100)
    expect(out.docs[0].markdown.length).toBe(100)
  })

  it("treats null markdown as empty string", () => {
    const out = assembleClusterPayload({ ...src, markdown_text: null }, [])
    expect(out.docs[0].markdown).toBe("")
  })

  it("defaults the cap to CLUSTER_DOC_CAP", () => {
    const big: ClusterDoc = { title: "Big", filename: "b.md", markdown_text: "y".repeat(CLUSTER_DOC_CAP + 500) }
    expect(assembleClusterPayload(big, []).docs[0].markdown.length).toBe(CLUSTER_DOC_CAP)
  })

  it("builds docsText joining each doc as a section, source first", () => {
    const out = assembleClusterPayload(src, [rel])
    expect(out.docsText).toContain("### Acme Q3 Pricing")
    expect(out.docsText).toContain("### Acme Renewal")
    expect(out.docsText.indexOf("Acme Q3 Pricing")).toBeLessThan(out.docsText.indexOf("Acme Renewal"))
    expect(out.docsText).toContain("---")
  })
})
