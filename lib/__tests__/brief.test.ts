import { describe, it, expect } from "vitest"
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
