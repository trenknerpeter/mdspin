"use client"

import { useState, type KeyboardEvent } from "react"
import { Layers, Inbox, Plus, Pencil, Trash2, Check, X } from "lucide-react"
import { UNFILED, type Project, type SpinStats, type TagCount } from "@/lib/library"

export function LibraryRail({
  projects,
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
  tags: TagCount[]
  stats: SpinStats
  selectedProject: string | null
  selectedTag: string | null
  onSelectProject: (id: string | null) => void
  onSelectTag: (tag: string | null) => void
  onCreateProject: (name: string) => Promise<unknown>
  onRenameProject: (id: string, name: string) => Promise<void>
  onDeleteProject: (id: string) => Promise<void>
}) {
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")

  const submitNew = async () => {
    const name = draft.trim()
    setDraft("")
    setCreating(false)
    if (name) await onCreateProject(name)
  }

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
          <span className="flex-1 text-left">All spins</span>
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
          {projects.map((p) => {
            const isActive = selectedProject === p.id
            if (editingId === p.id) {
              return (
                <div key={p.id} className="flex items-center gap-1 px-2.5 py-1">
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
            return (
              <div
                key={p.id}
                className={`${rowBase} ${isActive ? active : idle} cursor-pointer`}
                onClick={() => {
                  onSelectProject(p.id)
                  onSelectTag(null)
                }}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: p.color ?? "#4A4A46" }}
                />
                <span className="flex-1 truncate text-left">{p.name}</span>
                <span className="text-xs text-[#4A4A46] group-hover:hidden">
                  {stats.byProject[p.id] ?? 0}
                </span>
                <span className="hidden items-center gap-1.5 group-hover:flex">
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
                      if (confirm(`Delete project "${p.name}"? Its spins move to Unfiled.`)) {
                        onDeleteProject(p.id)
                      }
                    }}
                    className="text-[#888480] hover:text-red-400"
                    title="Delete project"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
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

          {projects.length === 0 && !creating && (
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
