"use client"

import { FolderPlus } from "lucide-react"
import { useState, type KeyboardEvent } from "react"
import { FolderCard } from "@/components/library/folder-card"
import type { FolderSummary, Project } from "@/lib/library"

// Folders whose contents changed most recently come first, so the grid reflects what
// you're actually working on. Empty folders sink to the bottom (no lastActivity) rather
// than sorting as "oldest", and ties fall back to name for a stable order.
export function sortFolders(
  summaries: FolderSummary[],
  nameById: Map<string, string>
): FolderSummary[] {
  return [...summaries].sort((a, b) => {
    if (a.lastActivity && b.lastActivity) {
      if (a.lastActivity !== b.lastActivity) return a.lastActivity < b.lastActivity ? 1 : -1
    } else if (a.lastActivity !== b.lastActivity) {
      return a.lastActivity ? -1 : 1
    }
    const an = a.projectId ? nameById.get(a.projectId) ?? "" : "Unfiled"
    const bn = b.projectId ? nameById.get(b.projectId) ?? "" : "Unfiled"
    return an.localeCompare(bn)
  })
}

export function FolderGrid({
  projects,
  summaries,
  onOpenFolder,
  onCreateProject,
}: {
  projects: Project[]
  summaries: FolderSummary[]
  onOpenFolder: (projectId: string | null) => void
  onCreateProject: (name: string) => Promise<unknown>
}) {
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState("")

  const projectById = new Map(projects.map((p) => [p.id, p]))
  const nameById = new Map(projects.map((p) => [p.id, p.name]))
  const summaryById = new Map(summaries.map((s) => [s.projectId, s]))

  // Only roots get a card; their sub-folders ride along as chips. Drop summaries for
  // projects that vanished between fetches rather than rendering a nameless card.
  const visible = sortFolders(summaries, nameById).filter(
    (s) => s.projectId === null || projectById.get(s.projectId)?.parent_id == null
  )

  // A root's card counts its own documents plus everything in its sub-folders, and its
  // "last activity" is the newest of any of them — otherwise filing documents one level
  // down would make a busy project look empty and stale.
  const rollUp = (s: FolderSummary): FolderSummary => {
    if (s.projectId === null) return s
    const children = projects.filter((p) => p.parent_id === s.projectId)
    if (children.length === 0) return s
    const kids = children.map((c) => summaryById.get(c.id)).filter(Boolean) as FolderSummary[]
    return {
      ...s,
      count: s.count + kids.reduce((n, k) => n + k.count, 0),
      lastActivity: [s.lastActivity, ...kids.map((k) => k.lastActivity)]
        .filter((d): d is string => !!d)
        .sort()
        .pop() ?? null,
    }
  }

  const submitNew = async () => {
    const name = draft.trim()
    setDraft("")
    setCreating(false)
    if (name) await onCreateProject(name)
  }

  const onNewKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") submitNew()
    if (e.key === "Escape") {
      setDraft("")
      setCreating(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {visible.map((s) => {
        const project = s.projectId ? projectById.get(s.projectId) : null
        const subFolders = s.projectId
          ? projects
              .filter((p) => p.parent_id === s.projectId)
              .map((p) => ({ id: p.id, name: p.name, count: summaryById.get(p.id)?.count ?? 0 }))
          : []
        return (
          <FolderCard
            key={s.projectId ?? "__unfiled__"}
            summary={rollUp(s)}
            name={project?.name ?? "Unfiled"}
            color={project?.color ?? null}
            subFolders={subFolders}
            onOpen={() => onOpenFolder(s.projectId)}
            onOpenSubFolder={(id) => onOpenFolder(id)}
          />
        )
      })}

      {creating ? (
        <div className="rounded-xl border border-[#4A4A46] bg-[#161616] p-4">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onNewKey}
            onBlur={submitNew}
            placeholder="Folder name…"
            className="w-full rounded-md border border-[#4A4A46] bg-[#0E0E0E] px-2 py-1 text-sm text-[#F0EDE8] placeholder:text-[#4A4A46] focus:outline-none"
          />
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="flex min-h-[92px] items-center justify-center gap-2 rounded-xl border border-dashed border-[#2A2A2A] p-4 text-sm text-[#4A4A46] transition-colors hover:border-[#4A4A46] hover:text-[#888480]"
        >
          <FolderPlus className="h-4 w-4" />
          New folder
        </button>
      )}
    </div>
  )
}
