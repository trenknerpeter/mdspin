import { describe, it, expect } from "vitest"
import {
  childrenOf,
  descendantProjectIds,
  isRootProject,
  projectPath,
  rollUpProjectCounts,
  rootProjectId,
  rootProjects,
  type Project,
} from "@/lib/library"

type Node = Pick<Project, "id" | "parent_id">
const TREE: Node[] = [
  { id: "plato", parent_id: null },
  { id: "saheed", parent_id: "plato" },
  { id: "jon", parent_id: "plato" },
  { id: "strategy", parent_id: null },
]
const byId = new Map(TREE.map((p) => [p.id, p]))

describe("rootProjectId", () => {
  it("returns a root project as its own root", () => {
    expect(rootProjectId("plato", byId)).toBe("plato")
  })

  it("resolves a subproject to its parent", () => {
    expect(rootProjectId("saheed", byId)).toBe("plato")
  })

  it("passes null through for unfiled documents", () => {
    expect(rootProjectId(null, byId)).toBeNull()
  })

  it("returns an unknown id unchanged rather than throwing", () => {
    expect(rootProjectId("ghost", byId)).toBe("ghost")
  })
})

describe("isRootProject", () => {
  it("is true for a project with no parent", () => {
    expect(isRootProject({ parent_id: null })).toBe(true)
  })

  it("is false for a subproject", () => {
    expect(isRootProject({ parent_id: "plato" })).toBe(false)
  })
})

describe("rootProjects", () => {
  it("returns only the top-level projects, preserving the full objects", () => {
    expect(rootProjects(TREE)).toEqual([
      { id: "plato", parent_id: null },
      { id: "strategy", parent_id: null },
    ])
  })

  it("returns an empty array when every project is a subproject", () => {
    expect(rootProjects([{ id: "kid", parent_id: "plato" }])).toEqual([])
  })
})

describe("childrenOf", () => {
  it("returns a root's direct subprojects", () => {
    expect(childrenOf("plato", TREE)).toEqual([
      { id: "saheed", parent_id: "plato" },
      { id: "jon", parent_id: "plato" },
    ])
  })

  it("returns nothing for a subproject — one level of nesting means it has no children", () => {
    expect(childrenOf("saheed", TREE)).toEqual([])
  })

  it("returns nothing for a childless root", () => {
    expect(childrenOf("strategy", TREE)).toEqual([])
  })
})

describe("descendantProjectIds", () => {
  it("returns a root together with its subprojects", () => {
    expect(descendantProjectIds("plato", TREE).sort()).toEqual(["jon", "plato", "saheed"])
  })

  it("returns just the subproject itself — nesting is capped at one level", () => {
    expect(descendantProjectIds("saheed", TREE)).toEqual(["saheed"])
  })

  it("returns a childless root alone", () => {
    expect(descendantProjectIds("strategy", TREE)).toEqual(["strategy"])
  })
})

describe("rollUpProjectCounts", () => {
  it("adds subproject counts into the parent while keeping the direct count", () => {
    const out = rollUpProjectCounts({ plato: 4, saheed: 3, jon: 2, strategy: 5 }, TREE)
    expect(out.plato).toBe(9)
    expect(out.saheed).toBe(3)
    expect(out.strategy).toBe(5)
  })

  it("counts subproject documents even when the parent holds none directly", () => {
    expect(rollUpProjectCounts({ saheed: 3 }, TREE).plato).toBe(3)
  })

  it("does not mutate the input", () => {
    const input = { plato: 1, saheed: 2 }
    rollUpProjectCounts(input, TREE)
    expect(input).toEqual({ plato: 1, saheed: 2 })
  })

  it("leaves a flat vault's counts untouched", () => {
    const flat: Node[] = [{ id: "a", parent_id: null }, { id: "b", parent_id: null }]
    expect(rollUpProjectCounts({ a: 2, b: 3 }, flat)).toEqual({ a: 2, b: 3 })
  })
})

describe("projectPath", () => {
  const byId = new Map([
    ["plato", { name: "Plato PM", parent_id: null }],
    ["faiaz", { name: "Faiaz", parent_id: "plato" }],
    ["strategy", { name: "Strategy", parent_id: null }],
  ])

  it("returns a root project's own name", () => {
    expect(projectPath("strategy", byId)).toBe("Strategy")
  })

  it("returns the full path for a subproject", () => {
    expect(projectPath("faiaz", byId)).toBe("Plato PM / Faiaz")
  })

  it("falls back to just the name if the parent is missing", () => {
    const orphaned = new Map([["kid", { name: "Kid", parent_id: "gone" }]])
    expect(projectPath("kid", orphaned)).toBe("Kid")
  })

  it("returns empty for an unknown project id", () => {
    expect(projectPath("ghost", byId)).toBe("")
  })
})
