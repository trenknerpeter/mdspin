import { describe, it, expect } from "vitest"
import { mapRelativePath, isIgnoredPath } from "@/lib/vault/paths"

const DEEP = "MyVault/Clients/Acme/notes/kickoff.md"

describe("mapRelativePath", () => {
  it("top-folder-project: first folder below the root is the project, rest are tags", () => {
    expect(mapRelativePath(DEEP, "top-folder-project")).toEqual({
      projectName: "Clients",
      tags: ["acme", "notes"],
    })
  })

  it("all-tags: creates no project", () => {
    expect(mapRelativePath(DEEP, "all-tags")).toEqual({
      projectName: null,
      tags: ["clients", "acme", "notes"],
    })
  })

  it("ignore: discards structure entirely", () => {
    expect(mapRelativePath(DEEP, "ignore")).toEqual({ projectName: null, tags: [] })
  })

  it("always strips the picked root, which carries no information", () => {
    expect(mapRelativePath("Whatever/Clients/a.md", "top-folder-project")).toEqual({
      projectName: "Clients",
      tags: [],
    })
  })

  it("returns nothing for a file sitting directly in the picked root", () => {
    expect(mapRelativePath("MyVault/readme.md", "top-folder-project")).toEqual({
      projectName: null,
      tags: [],
    })
  })

  it("handles a bare filename with no directories", () => {
    expect(mapRelativePath("readme.md", "top-folder-project")).toEqual({
      projectName: null,
      tags: [],
    })
  })

  it("normalises and de-duplicates derived tags", () => {
    expect(mapRelativePath("Root/P/Client Work/client-work/x.md", "top-folder-project")).toEqual({
      projectName: "P",
      tags: ["client-work"],
    })
  })

  it("preserves tag order from shallow to deep", () => {
    expect(mapRelativePath("R/P/one/two/three/x.md", "all-tags").tags).toEqual([
      "p",
      "one",
      "two",
      "three",
    ])
  })
})

describe("isIgnoredPath", () => {
  it("ignores Obsidian and tool directories", () => {
    expect(isIgnoredPath("MyVault/.obsidian/config.json")).toBe(true)
    expect(isIgnoredPath("MyVault/.trash/old.md")).toBe(true)
    expect(isIgnoredPath("MyVault/.git/HEAD")).toBe(true)
    expect(isIgnoredPath("MyVault/node_modules/pkg/readme.md")).toBe(true)
  })

  it("is case-insensitive on directory names", () => {
    expect(isIgnoredPath("MyVault/.Obsidian/x.md")).toBe(true)
  })

  it("ignores dotfiles", () => {
    expect(isIgnoredPath("MyVault/.gitignore")).toBe(true)
    expect(isIgnoredPath("MyVault/notes/.DS_Store")).toBe(true)
  })

  it("does not ignore ordinary notes", () => {
    expect(isIgnoredPath("MyVault/Clients/Acme/kickoff.md")).toBe(false)
    expect(isIgnoredPath("notes.md")).toBe(false)
  })

  it("does not ignore a filename that merely contains a dot", () => {
    expect(isIgnoredPath("MyVault/2026.07.30-standup.md")).toBe(false)
  })
})
