import { describe, it, expect, vi } from "vitest"
import { runListProjects, runGetProject, runGetRelatedDocuments, runCreateProject, runUpdateProject } from "@/lib/mcp/tools/projects"
import type { VaultRepo } from "@/lib/vault/repo"

function fakeRepo(overrides: Partial<VaultRepo> = {}): VaultRepo {
  return {
    listDocuments: async () => ({ data: [], page: { limit: 10, offset: 0, total: 0, hasMore: false, nextOffset: null } }),
    getDocument: async () => null,
    listProjects: async () => [],
    getProject: async () => null,
    getRelatedDocuments: async () => [],
    getStats: async () => ({ documentCount: 0, projectCount: 0, topTags: [] }),
    searchDocuments: async () => ({ data: [], page: { limit: 20, offset: 0, total: 0, hasMore: false, nextOffset: null } }),
    listDocumentsByCursor: async () => ({ data: [], nextCursor: null }),
    updateDocument: async () => {
      throw new Error("not used in this test")
    },
    createDocument: async () => {
      throw new Error("not used in this test")
    },
    appendToDocument: async () => {
      throw new Error("not used in this test")
    },
    organizeDocument: async () => {
      throw new Error("not used in this test")
    },
    removeFromVault: async () => {
      throw new Error("not used in this test")
    },
    createProject: async () => {
      throw new Error("not used in this test")
    },
    updateProject: async () => {
      throw new Error("not used in this test")
    },
    ...overrides,
  }
}

describe("runListProjects", () => {
  it("shapes every project via compactProject (no instructions)", async () => {
    const repo = fakeRepo({
      listProjects: async () => [{ id: "p1", name: "Strategy", color: null, createdAt: "x", instructions: "secret notes", parentId: null }],
    })
    const result = await runListProjects(repo)
    expect(result.projects).toEqual([{ id: "p1", name: "Strategy" }])
  })
})

describe("runGetProject", () => {
  it("includes instructions via compactProjectDetail", async () => {
    const repo = fakeRepo({
      getProject: async () => ({ id: "p1", name: "Strategy", color: null, createdAt: "x", instructions: "Focus on pricing.", parentId: null }),
    })
    const result = await runGetProject(repo, "p1")
    expect(result).toEqual({ id: "p1", name: "Strategy", instructions: "Focus on pricing.", created_at: "x" })
  })

  it("throws NOT_FOUND for a missing/foreign project", async () => {
    const repo = fakeRepo({ getProject: async () => null })
    await expect(runGetProject(repo, "missing")).rejects.toThrow(/not found/i)
  })
})

describe("runGetRelatedDocuments", () => {
  it("shapes each related document and forwards the limit", async () => {
    let seenLimit: number | undefined
    const repo = fakeRepo({
      getRelatedDocuments: async (_id: string, limit?: number) => {
        seenLimit = limit
        return [{
          id: "d2", filename: "f.md", title: null, fileType: "markdown", wordCount: 1,
          tags: [], projectId: "p1", convertedAt: "x", rank: 0.3, strength: "medium",
        }]
      },
    })
    const result = await runGetRelatedDocuments(repo, "d1", 5)
    expect(seenLimit).toBe(5)
    expect(result.related).toEqual([{ id: "d2", filename: "f.md", project_id: "p1", rank: 0.3, strength: "medium" }])
  })

  it("returns an empty array, not an error, when a document has no related docs", async () => {
    const repo = fakeRepo({ getRelatedDocuments: async () => [] })
    const result = await runGetRelatedDocuments(repo, "d1")
    expect(result.related).toEqual([])
  })
})

describe("project sub-folders", () => {
  const roots = [
    { id: "p1", name: "Plato PM", color: null, createdAt: "x", instructions: null, parentId: null },
    { id: "s1", name: "Saheed", color: null, createdAt: "x", instructions: null, parentId: "p1" },
    { id: "s2", name: "Jon", color: null, createdAt: "x", instructions: null, parentId: "p1" },
    { id: "p2", name: "Strategy", color: null, createdAt: "x", instructions: null, parentId: null },
  ]

  it("get_project lists a project's sub-folders inline", async () => {
    const repo = {
      getProject: async () => roots[0],
      listProjects: async () => roots,
    } as unknown as Parameters<typeof runGetProject>[0]
    const result = (await runGetProject(repo, "p1")) as Record<string, unknown>
    expect(result.children).toEqual([
      { id: "s1", name: "Saheed" },
      { id: "s2", name: "Jon" },
    ])
  })

  it("omits children entirely for a project that has none", async () => {
    const repo = {
      getProject: async () => roots[3],
      listProjects: async () => roots,
    } as unknown as Parameters<typeof runGetProject>[0]
    expect(await runGetProject(repo, "p2")).not.toHaveProperty("children")
  })

  it("a sub-folder reports no children of its own — nesting is one level", async () => {
    const repo = {
      getProject: async () => roots[1],
      listProjects: async () => roots,
    } as unknown as Parameters<typeof runGetProject>[0]
    expect(await runGetProject(repo, "s1")).not.toHaveProperty("children")
  })

  it("create_project forwards parent_id as parentId", async () => {
    const createProject = vi.fn().mockResolvedValue(roots[1])
    const repo = { createProject } as unknown as Parameters<typeof runCreateProject>[0]
    await runCreateProject(repo, { name: "Saheed", parent_id: "p1" })
    expect(createProject).toHaveBeenCalledWith({
      name: "Saheed", color: undefined, instructions: undefined, parentId: "p1",
    })
  })

  it("update_project forwards a null parent_id as a promotion to top level", async () => {
    const updateProject = vi.fn().mockResolvedValue(roots[0])
    const repo = { updateProject } as unknown as Parameters<typeof runUpdateProject>[0]
    await runUpdateProject(repo, { project_id: "s1", parent_id: null })
    expect(updateProject).toHaveBeenCalledWith("s1", { parentId: null })
  })
})

describe("runCreateProject", () => {
  it("passes name/color/instructions through and shapes the result via compactProjectDetail", async () => {
    const createProject = vi.fn().mockResolvedValue({
      id: "p1", name: "Explore", color: "blue", createdAt: "t", instructions: "Focus on new ideas.", parentId: null,
    })
    const repo = fakeRepo({ createProject })
    const result = await runCreateProject(repo, { name: "Explore", color: "blue", instructions: "Focus on new ideas." })
    expect(createProject).toHaveBeenCalledWith({ name: "Explore", color: "blue", instructions: "Focus on new ideas.", parentId: undefined })
    expect(result).toEqual({ id: "p1", name: "Explore", color: "blue", instructions: "Focus on new ideas.", created_at: "t" })
  })
})

describe("runUpdateProject", () => {
  it("builds a patch from only the provided fields", async () => {
    const updateProject = vi.fn().mockResolvedValue({ id: "p1", name: "Renamed", color: null, createdAt: "t", instructions: null, parentId: null })
    const repo = fakeRepo({ updateProject })
    await runUpdateProject(repo, { project_id: "p1", name: "Renamed" })
    expect(updateProject).toHaveBeenCalledWith("p1", { name: "Renamed" })
  })

  it("propagates a VaultError untouched", async () => {
    const updateProject = vi.fn().mockRejectedValue(new Error("boom"))
    const repo = fakeRepo({ updateProject })
    await expect(runUpdateProject(repo, { project_id: "p1", name: "x" })).rejects.toThrow("boom")
  })
})
