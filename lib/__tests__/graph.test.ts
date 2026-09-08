import { describe, it, expect } from "vitest"
import { buildGraph, type GraphNodeRow, type GraphEdgeRow } from "@/lib/graph"
import type { Project } from "@/lib/library"

const projects: Project[] = [
  { id: "p1", name: "Research", color: "#123456", created_at: "", parent_id: null },
  { id: "p2", name: "Marketing", color: null, created_at: "", parent_id: null }, // no color → fallback
]

function node(partial: Partial<GraphNodeRow> & { id: string }): GraphNodeRow {
  return {
    filename: "f.pdf",
    title: null,
    file_type: "pdf",
    word_count: 10,
    project_ids: [],
    tags: [],
    ...partial,
  }
}

describe("buildGraph", () => {
  it("labels with title, falling back to filename, and resolves community + color", () => {
    const nodes = [
      node({ id: "a", title: "Alpha", project_ids: ["p1"] }),
      node({ id: "b", title: null, filename: "beta.pdf", project_ids: ["p2"] }),
      node({ id: "c", project_ids: [] }), // unfiled
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

  it("picks the first project as primary when a node has more than one (pickPrimaryProject)", () => {
    const nodes = [node({ id: "a", project_ids: ["p2", "p1"] })]
    const g = buildGraph(nodes, [], projects)
    const a = g.nodes.find((n) => n.id === "a")!
    expect(a.projectId).toBe("p2")
    expect(a.community).toBe("Marketing")
  })
})

describe("buildGraph with sub-folders", () => {
  // p1 "Research" is a root with an explicit colour; s1 is a sub-folder of it.
  const nested: Project[] = [
    { id: "p1", name: "Research", color: "#123456", created_at: "", parent_id: null },
    { id: "s1", name: "Saheed", color: null, created_at: "", parent_id: "p1" },
  ]

  it("colours a document in a sub-folder by its ROOT, so the project stays one community", () => {
    const g = buildGraph(
      [node({ id: "a", project_ids: ["p1"] }), node({ id: "b", project_ids: ["s1"] })],
      [],
      nested
    )
    const [a, b] = g.nodes
    expect(b.color).toBe(a.color)
    expect(b.community).toBe("Research")
  })

  it("still reports the document's own folder as projectId", () => {
    const g = buildGraph([node({ id: "b", project_ids: ["s1"] })], [], nested)
    expect(g.nodes[0].projectId).toBe("s1")
  })

  it("does not let a new sub-folder shift a colourless root's fallback colour", () => {
    const before: Project[] = [
      { id: "p1", name: "Research", color: "#123456", created_at: "", parent_id: null },
      { id: "p2", name: "Marketing", color: null, created_at: "", parent_id: null },
    ]
    // Same roots, but a sub-folder now sits between them in the array.
    const after: Project[] = [
      { id: "p1", name: "Research", color: "#123456", created_at: "", parent_id: null },
      { id: "s1", name: "Saheed", color: null, created_at: "", parent_id: "p1" },
      { id: "p2", name: "Marketing", color: null, created_at: "", parent_id: null },
    ]
    const colorOf = (projects: Project[]) =>
      buildGraph([node({ id: "m", project_ids: ["p2"] })], [], projects).nodes[0].color
    expect(colorOf(after)).toBe(colorOf(before))
  })
})
