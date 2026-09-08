import { describe, it, expect } from "vitest"
import { computeFolderSummaries, type FolderSummaryRow } from "@/lib/library"

const PROJECTS = [{ id: "p1" }, { id: "p2" }]

// Newest first, matching the order listFolderSummaries' query guarantees.
const ROWS: FolderSummaryRow[] = [
  { title: "Newest", filename: "c.md", converted_at: "2026-09-06T00:00:00Z", project_ids: ["p1"] },
  { title: null, filename: "untitled.md", converted_at: "2026-09-05T00:00:00Z", project_ids: ["p1"] },
  { title: "Loose", filename: "b.md", converted_at: "2026-09-04T00:00:00Z", project_ids: [] },
  { title: "Oldest", filename: "a.md", converted_at: "2026-09-03T00:00:00Z", project_ids: ["p1"] },
]

const byId = (rows: FolderSummaryRow[] = ROWS, projects = PROJECTS) =>
  new Map(computeFolderSummaries(rows, projects).map((f) => [f.projectId, f]))

describe("computeFolderSummaries", () => {
  it("counts documents per folder", () => {
    expect(byId().get("p1")!.count).toBe(3)
  })

  it("buckets documents with no project membership as Unfiled", () => {
    const unfiled = byId().get(null)!
    expect(unfiled.count).toBe(1)
    expect(unfiled.recentTitles).toEqual(["Loose"])
  })

  it("reports the newest converted_at as last activity", () => {
    expect(byId().get("p1")!.lastActivity).toBe("2026-09-06T00:00:00Z")
  })

  it("keeps recent titles newest-first and caps them at 3", () => {
    const many: FolderSummaryRow[] = Array.from({ length: 5 }, (_, i) => ({
      title: `T${i}`,
      filename: `${i}.md`,
      converted_at: `2026-09-0${5 - i}T00:00:00Z`,
      project_ids: ["p1"],
    }))
    expect(byId(many).get("p1")!.recentTitles).toEqual(["T0", "T1", "T2"])
  })

  it("falls back to the filename when a document has no title", () => {
    expect(byId().get("p1")!.recentTitles).toEqual(["Newest", "untitled.md", "Oldest"])
  })

  it("emits an entry for an empty project so its card still renders", () => {
    const empty = byId().get("p2")!
    expect(empty).toEqual({ projectId: "p2", count: 0, lastActivity: null, recentTitles: [] })
  })

  it("always emits an Unfiled bucket, even when nothing is unfiled", () => {
    const rows = [ROWS[0]]
    expect(byId(rows).get(null)).toEqual({
      projectId: null, count: 0, lastActivity: null, recentTitles: [],
    })
  })

  it("ignores membership pointing at a project it wasn't given", () => {
    const rows: FolderSummaryRow[] = [
      { title: "Ghost", filename: "g.md", converted_at: "2026-09-06T00:00:00Z", project_ids: ["gone"] },
    ]
    const folders = computeFolderSummaries(rows, PROJECTS)
    expect(folders.find((f) => f.projectId === "gone")).toBeUndefined()
    // and it is NOT silently counted as Unfiled — it has a home, just an unknown one
    expect(folders.find((f) => f.projectId === null)!.count).toBe(0)
  })
})
