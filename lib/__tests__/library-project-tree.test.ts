import { describe, it, expect } from "vitest"
import {
  descendantProjectIds,
  rollUpProjectCounts,
  rootProjectId,
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

  it("resolves a sub-folder to its parent", () => {
    expect(rootProjectId("saheed", byId)).toBe("plato")
  })

  it("passes null through for unfiled documents", () => {
    expect(rootProjectId(null, byId)).toBeNull()
  })

  it("returns an unknown id unchanged rather than throwing", () => {
    expect(rootProjectId("ghost", byId)).toBe("ghost")
  })
})

describe("descendantProjectIds", () => {
  it("returns a root together with its sub-folders", () => {
    expect(descendantProjectIds("plato", TREE).sort()).toEqual(["jon", "plato", "saheed"])
  })

  it("returns just the sub-folder itself — nesting is capped at one level", () => {
    expect(descendantProjectIds("saheed", TREE)).toEqual(["saheed"])
  })

  it("returns a childless root alone", () => {
    expect(descendantProjectIds("strategy", TREE)).toEqual(["strategy"])
  })
})

describe("rollUpProjectCounts", () => {
  it("adds sub-folder counts into the parent while keeping the direct count", () => {
    const out = rollUpProjectCounts({ plato: 4, saheed: 3, jon: 2, strategy: 5 }, TREE)
    expect(out.plato).toBe(9)
    expect(out.saheed).toBe(3)
    expect(out.strategy).toBe(5)
  })

  it("counts sub-folder documents even when the parent holds none directly", () => {
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
