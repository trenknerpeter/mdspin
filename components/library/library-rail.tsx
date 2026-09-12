"use client"

import { useState, type KeyboardEvent } from "react"
import {
  Layers,
  Inbox,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ChevronRight,
  ChevronDown,
  FolderPlus,
  MoreVertical,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  PROJECT_COLOR_PRESETS,
  UNFILED,
  type Project,
  type SpinStats,
  type TagCount,
} from "@/lib/library"
import { Palette } from "lucide-react"

export function LibraryRail({
  roots,
  childrenByParent,
  statsRollup,
  tags,
  stats,
  selectedProject,
  selectedTags,
  onSelectProject,
  onToggleTag,
  onClearTags,
  onCreateProject,
  onRenameProject,
  onSetProjectColor,
  onDeleteProject,
}: {
  /** Top-level projects, in display order. */
  roots: Project[]
  /** Subprojects keyed by parent id. */
  childrenByParent: Map<string, Project[]>
  /** Per-project counts including subprojects — used for root rows only. */
  statsRollup: Record<string, number>
  tags: TagCount[]
  stats: SpinStats
  selectedProject: string | null
  /** Every tag here must be present on a doc (AND) — [] means no tag filter. */
  selectedTags: string[]
  onSelectProject: (id: string | null) => void
  onToggleTag: (tag: string) => void
  onClearTags: () => void
  onCreateProject: (name: string, parentId?: string | null) => Promise<unknown>
  onRenameProject: (id: string, name: string) => Promise<void>
  onSetProjectColor: (id: string, color: string | null) => Promise<void>
  onDeleteProject: (id: string) => Promise<void>
}) {
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [subCreatingFor, setSubCreatingFor] = useState<string | null>(null)
  const [subDraft, setSubDraft] = useState("")
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  // Controlled so the row can keep the kebab visible (and the count hidden) while its
  // menu is open — otherwise moving the pointer off the row to reach the menu would
  // drop group-hover and make the trigger vanish underneath the cursor.
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null)

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

  const expand = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })

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
    "group flex w-full items-center gap-2 rounded-lg py-1.5 pr-1.5 text-sm transition-colors"
  const active = "bg-[#FF4800]/12 text-[#FF4800]"
  const idle = "text-[#C9C5BE] hover:bg-[#1E1E1E]"
  // The app's signature interaction is the accent at ~12% with accent-coloured text —
  // the same treatment the active rail row uses — so the menu echoes that instead of a
  // neutral grey highlight. Destructive keeps a cooler red so it stays distinguishable
  // from the orange accent at small sizes.
  const menuItem =
    "gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-[#C9C5BE] transition-colors " +
    "focus:bg-[#FF4800]/12 focus:text-[#FF4800] data-[highlighted]:bg-[#FF4800]/12 data-[highlighted]:text-[#FF4800]"
  const menuItemDanger =
    "gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-[#FF6B6B] transition-colors " +
    "focus:bg-[#FF6B6B]/12 focus:text-[#FF6B6B] data-[highlighted]:bg-[#FF6B6B]/12 data-[highlighted]:text-[#FF6B6B]"

  const renameInput = (p: Project, isRoot: boolean) => (
    <div className={`flex items-center gap-1 py-1 pr-1.5 ${isRoot ? "pl-2.5" : "pl-[30px]"}`}>
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

  // One renderer for both levels. A subproject is visually distinguished by the tree
  // connector its wrapper draws, by its indent, and by having no colour swatch — the
  // parent's colour already identifies the group, so repeating it made every row read
  // as a peer.
  const renderRow = (
    p: Project,
    opts: { isRoot: boolean; childCount?: number; isCollapsed?: boolean }
  ) => {
    if (editingId === p.id) return renameInput(p, opts.isRoot)

    const isActive = selectedProject === p.id
    const childCount = opts.childCount ?? 0
    const count = opts.isRoot ? statsRollup[p.id] ?? 0 : stats.byProject[p.id] ?? 0
    const menuOpen = menuOpenFor === p.id

    return (
      <div
        className={`${rowBase} ${isActive ? active : idle} cursor-pointer ${
          opts.isRoot ? "pl-1" : "pl-[30px]"
        }`}
        onClick={() => {
          onSelectProject(p.id)
          onClearTags()
        }}
      >
        {opts.isRoot &&
          (childCount > 0 ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggle(p.id)
              }}
              className="shrink-0 rounded text-[#4A4A46] hover:text-[#F0EDE8]"
              title={opts.isCollapsed ? "Show subprojects" : "Hide subprojects"}
              aria-expanded={!opts.isCollapsed}
            >
              {opts.isCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          ) : (
            <span className="w-3.5 shrink-0" aria-hidden />
          ))}

        {opts.isRoot && (
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ background: p.color ?? "#4A4A46" }}
            aria-hidden
          />
        )}

        <span className={`flex-1 truncate text-left ${opts.isRoot ? "" : "text-[#A8A49E]"}`}>
          {p.name}
        </span>

        {/* Count and kebab share one slot, the kebab layered over the count. Toggling
            opacity rather than display keeps the button keyboard-focusable (display:none
            can't be tabbed to) and stops the row width jumping on hover. pointer-events
            are dropped while it's invisible so a click there still selects the project. */}
        <span className="relative flex min-w-6 shrink-0 items-center justify-end">
          <span
            className={`text-xs text-[#4A4A46] transition-opacity ${
              menuOpen ? "opacity-0" : "group-hover:opacity-0"
            }`}
          >
            {count}
          </span>

          <DropdownMenu
            open={menuOpen}
            onOpenChange={(o) => setMenuOpenFor(o ? p.id : null)}
          >
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className={`absolute right-0 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-[#888480] transition-opacity hover:bg-[#2A2A2A] hover:text-[#F0EDE8] focus-visible:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 ${
                  menuOpen
                    ? "bg-[#2A2A2A] text-[#F0EDE8] opacity-100"
                    : "pointer-events-none opacity-0"
                }`}
                title={`Actions for ${p.name}`}
                aria-label={`Actions for ${p.name}`}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={6}
              className="min-w-48 rounded-xl border-[#2A2A2A] bg-[#161616] p-1 text-[#F0EDE8] shadow-[0_18px_44px_-12px_rgba(0,0,0,0.85)]"
            >
              {/* Echoes the rail's own PROJECTS / TAGS micro-labels, and confirms which
                  row you opened when several are stacked close together. */}
              <div className="truncate px-2.5 pb-1.5 pt-1 font-display text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4A4A46]">
                {p.name}
              </div>
            {/* Subprojects only under a top-level project: nesting is capped at one level
                by the projects_single_level trigger, so offering it here would just error. */}
            {opts.isRoot && (
              <DropdownMenuItem
                className={menuItem}
                onSelect={() => {
                  expand(p.id)
                  setSubCreatingFor(p.id)
                }}
              >
                <FolderPlus className="h-3.5 w-3.5" /> Add subproject
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className={menuItem}
              onSelect={() => {
                setEditingId(p.id)
                setEditName(p.name)
              }}
            >
              <Pencil className="h-3.5 w-3.5" /> Rename
            </DropdownMenuItem>
            {/* Colour lives on the root only: a subproject never renders its own swatch
                (the rail, the list chip and the Knowledge Map all colour it by its root),
                so offering a colour picker there would set a value nothing ever shows. */}
            {opts.isRoot && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={menuItem}>
                  <Palette className="h-3.5 w-3.5" /> Change color
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  className="min-w-0 rounded-xl border-[#2A2A2A] bg-[#161616] p-2 text-[#F0EDE8]"
                  sideOffset={4}
                >
                  <div className="grid grid-cols-4 gap-1.5">
                    {PROJECT_COLOR_PRESETS.map((c) => (
                      <button
                        key={c}
                        onClick={() => onSetProjectColor(p.id, c)}
                        className="flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F0EDE8]"
                        style={{ background: c }}
                        title={c}
                        aria-label={`Set color ${c}`}
                      >
                        {p.color === c && <Check className="h-3.5 w-3.5 text-white/90" />}
                      </button>
                    ))}
                  </div>
                  {p.color && (
                    <button
                      onClick={() => onSetProjectColor(p.id, null)}
                      className="mt-2 w-full rounded-lg px-2 py-1.5 text-left text-xs text-[#888480] transition-colors hover:bg-[#FF4800]/12 hover:text-[#FF4800]"
                    >
                      Clear color
                    </button>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            <DropdownMenuSeparator className="mx-1 my-1 bg-[#2A2A2A]" />
            <DropdownMenuItem
              className={menuItemDanger}
              onSelect={() => {
                // Deleting a root cascades its subprojects (projects_parent_user_fkey),
                // so the confirm names both, not just the documents.
                const subs =
                  childCount > 0
                    ? ` and its ${childCount} subproject${childCount === 1 ? "" : "s"}`
                    : ""
                const msg = `Delete "${p.name}"${subs}? ${count} document${
                  count === 1 ? "" : "s"
                } move to Unfiled.`
                if (confirm(msg)) onDeleteProject(p.id)
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
            onClearTags()
          }}
          className={`${rowBase} px-2.5 ${selectedProject === null && selectedTags.length === 0 ? active : idle}`}
        >
          <Layers className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">All files</span>
          <span className="text-xs text-[#4A4A46]">{stats.total}</span>
        </button>
        <button
          onClick={() => {
            onSelectProject(UNFILED)
            onClearTags()
          }}
          className={`${rowBase} px-2.5 ${selectedProject === UNFILED ? active : idle}`}
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
            const showChildren = !isCollapsed && children.length > 0
            const creatingHere = subCreatingFor === root.id
            return (
              <div key={root.id}>
                {renderRow(root, {
                  isRoot: true,
                  childCount: children.length,
                  isCollapsed,
                })}

                {(showChildren || creatingHere) && (
                  // No space-y and a negative top margin on purpose: the connector trunk
                  // is drawn per row, so any gap between rows would punch visible breaks
                  // in it, and the -mt bridges the parent row's own gap.
                  <div className="-mt-0.5">
                    {showChildren &&
                      children.map((child, i) => {
                        // Last child only when nothing is being appended below it, so the
                        // trunk keeps running down to an in-progress "new subproject" row.
                        const isLast = i === children.length - 1 && !creatingHere
                        return (
                          <div key={child.id} className="relative">
                            <span
                              aria-hidden
                              className={`absolute left-[15px] top-0 w-px bg-[#3A3A38] ${
                                isLast ? "h-[18px]" : "bottom-0"
                              }`}
                            />
                            <span
                              aria-hidden
                              className="absolute left-[15px] top-[18px] h-px w-[9px] bg-[#3A3A38]"
                            />
                            {renderRow(child, { isRoot: false })}
                          </div>
                        )
                      })}

                    {creatingHere && (
                      <div className="relative">
                        <span aria-hidden className="absolute left-[15px] top-0 h-[18px] w-px bg-[#3A3A38]" />
                        <span aria-hidden className="absolute left-[15px] top-[18px] h-px w-[9px] bg-[#3A3A38]" />
                        <div className="py-1 pl-[30px] pr-1.5">
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
                            placeholder="Subproject name…"
                            className="w-full rounded-md border border-[#4A4A46] bg-[#0E0E0E] px-2 py-1 text-sm text-[#F0EDE8] placeholder:text-[#4A4A46] focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
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
              const isActive = selectedTags.includes(t.tag)
              return (
                <button
                  key={t.tag}
                  onClick={() => onToggleTag(t.tag)}
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
