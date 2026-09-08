"use client"

import { useState, type KeyboardEvent } from "react"
import { Layers, Inbox, Plus, Pencil, Trash2, Check, X, ChevronRight, ChevronDown, FolderPlus } from "lucide-react"
import { UNFILED, type Project, type SpinStats, type TagCount } from "@/lib/library"

export function LibraryRail({
  projects,
  roots,
  childrenByParent,
  statsRollup,
  tags,
  stats,
  selectedProject,
  selectedTag,
  onSelectProject,
  onSelectTag,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
}: {
  projects: Project[]
  /** Top-level projects, in display order. */
  roots: Project[]
  /** Sub-folders keyed by parent id. */
  childrenByParent: Map<string, Project[]>
  /** Per-project counts including sub-folders — used for root rows only. */
  statsRollup: Record<string, number>
  tags: TagCount[]
  stats: SpinStats
  selectedProject: string | null
  selectedTag: string | null
  onSelectProject: (id: string | null) => void
  onSelectTag: (tag: string | null) => void
  onCreateProject: (name: string, parentId?: string | null) => Promise<unknown>
  onRenameProject: (id: string, name: string) => Promise<void>
  onDeleteProject: (id: string) => Promise<void>
}) {
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  // Which root is creating a sub-folder inline, and which roots are expanded.
  const [subCreatingFor, setSubCreatingFor] = useState<string | null>(null)
  const [subDraft, setSubDraft] = useState("")
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const submitNew = async () => {
    const name = draft.trim()
    setDraft("")
    setCreating(false)
    if (name) await onCreateProject(name)
  }

  const submitSub = async (parentId: string) => {
    const name = subDraft.trim()
    setSubDraft("")
    setSubCreatingFor(null)
    if (name) await onCreateProject(name, parentId)
  }

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const submitRename = async (id: string) => {
    const name = editName.trim()
    setEditingId(null)
    if (name) await onRenameProject(id, name)
  }

  const onNewKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") submitNew()
    if (e.key === "Escape") {
      setDraft("")
      setCreating(false)
    }
  }

  const rowBase =
    "group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors"
  const active = "bg-[#FF4800]/12 text-[#FF4800]"
  const idle = "text-[#C9C5BE] hover:bg-[#1E1E1E]"

  // One renderer for both levels: a sub-folder row is the same row, indented, with a
  // direct count instead of a rolled-up one and no "new sub-folder" action (nesting is
  // capped at one level by the projects_single_level trigger).
  const renderRow = (
    p: Project,
    opts: { isRoot: boolean; childCount?: number; isCollapsed?: boolean }
  ) => {
    const isActive = selectedProject === p.id
    if (editingId === p.id) {
      return (
        <div className={`flex items-center gap-1 py-1 pr-2.5 ${opts.isRoot ? "pl-2.5" : "pl-7"}`}>
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename(p.id)
              if (e.key === "Escape") setEditingId(null)
            }}
            className="min-w-0 flex-1 rounded-md border border-[#4A4A46] bg-[#0E0E0E] px-2 py-1 text-sm text-[#F0EDE8] focus:outline-none"
          />
          <button onClick={() => submitRename(p.id)} className="text-[#888480] hover:text-[#FF4800]">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setEditingId(null)} className="text-[#888480] hover:text-[#F0EDE8]">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )
    }
    const count = opts.isRoot ? statsRollup[p.id] ?? 0 : stats.byProject[p.id] ?? 0
    const childCount = opts.childCount ?? 0
    return (
      <div
        className={`${rowBase} ${isActive ? active : idle} cursor-pointer ${opts.isRoot ? "" : "pl-7"}`}
        onClick={() => {
          onSelectProject(p.id)
          onSelectTag(null)
        }}
      >
        {opts.isRoot && childCount > 0 ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggle(p.id)
            }}
            className="-ml-1 shrink-0 text-[#4A4A46] hover:text-[#F0EDE8]"
            title={opts.isCollapsed ? "Show sub-folders" : "Hide sub-folders"}
            aria-expanded={!opts.isCollapsed}
          >
            {opts.isCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          opts.isRoot && <span className="w-2.5 shrink-0" />
        )}
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-sm"
          style={{ background: p.color ?? "#4A4A46" }}
        />
        <span className="flex-1 truncate text-left">{p.name}</span>
        <span className="text-xs text-[#4A4A46] group-hover:hidden">{count}</span>
        <span className="hidden items-center gap-1.5 group-hover:flex">
          {opts.isRoot && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setCollapsed((prev) => {
                  const next = new Set(prev)
                  next.delete(p.id)
                  return next
                })
                setSubCreatingFor(p.id)
              }}
              className="text-[#888480] hover:text-[#F0EDE8]"
              title="New sub-folder"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setEditingId(p.id)
              setEditName(p.name)
            }}
            className="text-[#888480] hover:text-[#F0EDE8]"
            title="Rename"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              // Deleting a root cascades its sub-folders (projects_parent_user_fkey),
              // so the confirm has to name both, not just the documents.
              const docs = opts.isRoot ? statsRollup[p.id] ?? 0 : stats.byProject[p.id] ?? 0
              const subs = childCount > 0 ? ` and its ${childCount} sub-folder${childCount === 1 ? "" : "s"}` : ""
              const msg = `Delete "${p.name}"${subs}? ${docs} document${docs === 1 ? "" : "s"} move to Unfiled.`
              if (confirm(msg)) onDeleteProject(p.id)
            }}
            className="text-[#888480] hover:text-red-400"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>
    )
  }

  return (
    <aside className="w-56 shrink-0 space-y-6">
      {/* Library scope */}
      <div className="space-y-0.5">
        <button
          onClick={() => {
            onSelectProject(null)
            onSelectTag(null)
          }}
          className={`${rowBase} ${selectedProject === null && !selectedTag ? active : idle}`}
        >
          <Layers className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">All files</span>
          <span className="text-xs text-[#4A4A46]">{stats.total}</span>
        </button>
        <button
          onClick={() => {
            onSelectProject(UNFILED)
            onSelectTag(null)
          }}
          className={`${rowBase} ${selectedProject === UNFILED ? active : idle}`}
        >
          <Inbox className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Unfiled</span>
          <span className="text-xs text-[#4A4A46]">{stats.unfiled}</span>
        </button>
      </div>

      {/* Projects */}
      <div className="space-y-1">
        <div className="flex items-center justify-between px-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#888480]">
            Projects
          </span>
          <button
            onClick={() => setCreating(true)}
            className="text-[#888480] hover:text-[#F0EDE8]"
            title="New project"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-0.5">
          {roots.map((root) => {
            const children = childrenByParent.get(root.id) ?? []
            const isCollapsed = collapsed.has(root.id)
            return (
              <div key={root.id}>
                {renderRow(root, { isRoot: true, childCount: children.length, isCollapsed })}
                {!isCollapsed &&
                  children.map((child) => (
                    <div key={child.id}>{renderRow(child, { isRoot: false })}</div>
                  ))}
                {subCreatingFor === root.id && (
                  <div className="py-1 pl-7 pr-2.5">
                    <input
                      autoFocus
                      value={subDraft}
                      onChange={(e) => setSubDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitSub(root.id)
                        if (e.key === "Escape") {
                          setSubDraft("")
                          setSubCreatingFor(null)
                        }
                      }}
                      onBlur={() => submitSub(root.id)}
                      placeholder="Sub-folder name…"
                      className="w-full rounded-md border border-[#4A4A46] bg-[#0E0E0E] px-2 py-1 text-sm text-[#F0EDE8] placeholder:text-[#4A4A46] focus:outline-none"
                    />
                  </div>
                )}
              </div>
            )
          })}

          {creating && (
            <div className="px-2.5 py-1">
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onNewKey}
                onBlur={submitNew}
                placeholder="Project name…"
                className="w-full rounded-md border border-[#4A4A46] bg-[#0E0E0E] px-2 py-1 text-sm text-[#F0EDE8] placeholder:text-[#4A4A46] focus:outline-none"
              />
            </div>
          )}

          {roots.length === 0 && !creating && (
            <p className="px-2.5 py-1 text-xs text-[#4A4A46]">No projects yet.</p>
          )}
        </div>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="space-y-1.5">
          <span className="px-2.5 text-[10px] font-semibold uppercase tracking-wide text-[#888480]">
            Tags
          </span>
          <div className="flex flex-wrap gap-1.5 px-2.5">
            {tags.map((t) => {
              const isActive = selectedTag === t.tag
              return (
                <button
                  key={t.tag}
                  onClick={() => onSelectTag(isActive ? null : t.tag)}
                  className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                    isActive
                      ? "bg-[#FF4800] text-white"
                      : "bg-[#FF4800]/10 text-[#FF4800] hover:bg-[#FF4800]/20"
                  }`}
                >
                  #{t.tag}
                  <span className={isActive ? "text-white/70" : "text-[#FF4800]/50"}> {t.count}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </aside>
  )
}
