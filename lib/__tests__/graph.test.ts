import { describe, it, expect } from "vitest"
import { buildGraph, type GraphNodeRow, type GraphEdgeRow } from "@/lib/graph"
import type { Project } from "@/lib/library"

const projects: Project[] = [
  { id: "p1", name: "Research", color: "#123456", created_at: "" },
  { id: "p2", name: "Marketing", color: null, created_at: "" }, // no color → fallback
]

function node(partial: Partial<GraphNodeRow> & { id: string }): GraphNodeRow {
  return {
    filename: "f.pdf",
    title: null,
    file_type: "pdf",
    word_count: 10,
    project_id: null,
    tags: [],
    ...partial,
  }
}

describe("buildGraph", () => {
  it("labels with title, falling back to filename, and resolves community + color", () => {
    const nodes = [
      node({ id: "a", title: "Alpha", project_id: "p1" }),
      node({ id: "b", title: null, filename: "beta.pdf", project_id: "p2" }),
      node({ id: "c", project_id: null }), // unfiled
    ]
    const g = buildGraph(nodes, [], projects)
    const a = g.nodes.find((n) => n.id === "a")!
    const b = g.nodes.find((n) => n.id === "b")!
    const c = g.nodes.find((n) => n.id === "c")!
    expect(a).toMatchObject({ label: "Alpha", community: "Research", color: "#123456" })
    expect(b).toMatchObject({ label: "beta.pdf", community: "Marketing" })
    expect(b.color).not.toBe("#888480") // got a fallback palette color
    expect(c).toMatchObject({ community: "Unfiled", color: "#888480" })
  })

  it("dedupes edges by unordered pair keeping the highest weight", () => {
    const nodes = [node({ id: "a" }), node({ id: "b" })]
    const edges: GraphEdgeRow[] = [
      { source_id: "a", target_id: "b", weight: 0.2 },
      { source_id: "b", target_id: "a", weight: 0.5 }, // same pair, higher weight
    ]
    const g = buildGraph(nodes, edges, projects)
    expect(g.links).toHaveLength(1)
    expect(g.links[0]).toMatchObject({ source: "a", target: "b", weight: 0.5 })
  })

  it("drops edges with an unknown endpoint and self-loops", () => {
    const nodes = [node({ id: "a" }), node({ id: "b" })]
    const edges: GraphEdgeRow[] = [
      { source_id: "a", target_id: "ghost", weight: 0.9 },
      { source_id: "a", target_id: "a", weight: 0.9 },
    ]
    const g = buildGraph(nodes, edges, projects)
    expect(g.links).toHaveLength(0)
  })
})
