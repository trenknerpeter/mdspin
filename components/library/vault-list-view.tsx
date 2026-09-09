"use client"

import Link from "next/link"
import { Search, FileText, Copy, Check, Sparkles, FolderInput, Inbox } from "lucide-react"
import { useRef, useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { useLibrary } from "@/components/library/use-library"
import { getSpinMarkdown, primaryProjectId } from "@/lib/library"

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

// The Vault's flat document list: search box, load/error/empty states, rows, "Load more".
// Extracted verbatim from app/app/vault/page.tsx so the folder grid and the list can share
// it — taking the whole hook rather than ~15 individual props, since every field here is
// already one object on the caller's side.
export function VaultListView({ lib }: { lib: ReturnType<typeof useLibrary> }) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copyingId, setCopyingId] = useState<string | null>(null)
  // Radix's onCheckedChange doesn't carry the originating event, so the modifier is
  // recorded on the way in. onCheckedChange stays the SINGLE toggle handler — pairing it
  // with an onClick fires both and the row silently toggles twice back to where it was.
  const shiftHeld = useRef(false)

  // List rows no longer carry markdown_text (SPIN_LIST_FIELDS omits it — a
  // single doc can be 2.4MB), so the row-level copy button fetches on demand.
  const handleCopy = async (id: string) => {
    setCopyingId(id)
    try {
      const text = await getSpinMarkdown(id)
      if (!text) return
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } finally {
      setCopyingId(null)
    }
  }

  const selectionActive = lib.selectedIds.size > 0
  const roots = lib.projects.filter((p) => !p.parent_id)
  const menuItem =
    "gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-[#C9C5BE] transition-colors " +
    "focus:bg-[#FF4800]/12 focus:text-[#FF4800] data-[highlighted]:bg-[#FF4800]/12 data-[highlighted]:text-[#FF4800]"

  const filtersActive = lib.selectedProject !== null || !!lib.selectedTag || lib.search.trim() !== ""
  const clearFilters = () => {
    lib.setSelectedProject(null)
    lib.setSelectedTag(null)
    lib.setSearch("")
  }

  return (
    <>
      {/* Search */}
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4A4A46]" />
        <input
          value={lib.search}
          onChange={(e) => lib.setSearch(e.target.value)}
          placeholder="Search filenames and content…"
          className="w-full rounded-xl border border-[#2A2A2A] bg-[#161616] py-2.5 pl-10 pr-4 text-sm text-[#F0EDE8] placeholder:text-[#4A4A46] focus:border-[#4A4A46] focus:outline-none"
        />
      </div>

      {lib.loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <svg className="h-6 w-6 animate-spin text-[#FF4800]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      ) : lib.error ? (
        <div className="rounded-xl border border-[#FF4800]/30 bg-[#161616] p-12 text-center">
          <p className="font-sans text-sm text-[#FF4800]">
            Couldn&apos;t load your spins: {lib.error}
          </p>
          <button
            onClick={() => lib.reload()}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#2A2A2A] px-5 py-2 text-sm font-semibold text-[#F0EDE8] transition-colors hover:border-[#4A4A46]"
          >
            Try again
          </button>
        </div>
      ) : lib.spins.length === 0 ? (
        <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-12 text-center">
          <FileText className="mx-auto mb-3 h-8 w-8 text-[#4A4A46]" />
          {filtersActive ? (
            <>
              <p className="font-sans text-sm text-[#888480]">
                No spins match these filters.
              </p>
              <button
                onClick={clearFilters}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#2A2A2A] px-5 py-2 text-sm font-semibold text-[#F0EDE8] transition-colors hover:border-[#4A4A46]"
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <p className="font-sans text-sm text-[#888480]">
                Your Vault is empty.
              </p>
              <p className="font-sans text-sm text-[#888480]">
                Add markdown directly, or convert a file first.
              </p>
              <div className="mt-4 flex justify-center gap-3">
                <Link
                  href="/app/vault/add"
                  className="inline-flex items-center gap-2 rounded-full bg-[#FF4800] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#e04200]"
                >
                  Add markdown
                </Link>
                <Link
                  href="/app"
                  className="inline-flex items-center gap-2 rounded-full border border-[#2A2A2A] px-5 py-2 text-sm font-semibold text-[#F0EDE8] transition-colors hover:border-[#4A4A46]"
                >
                  Convert a file
                </Link>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {lib.spins.map((c) => {
              const isSelected = lib.selectedIds.has(c.id)
              return (
              // A div, not a button: a row now contains a checkbox, and nesting
              // interactive elements inside a <button> is invalid and breaks keyboard use.
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onClick={() => lib.openSpin(c.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    lib.openSpin(c.id)
                  }
                }}
                className={`group w-full cursor-pointer rounded-xl border bg-[#161616] p-4 text-left transition-colors focus:outline-none focus-visible:border-[#4A4A46] ${
                  isSelected
                    ? "border-[#FF4800]/40 bg-[#FF4800]/[0.04]"
                    : "border-[#2A2A2A] hover:border-[#3A3A3A]"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Reserved column: the checkbox fades in rather than appearing, so the
                      row doesn't reflow on hover. */}
                  <span
                    className="flex shrink-0 items-center pt-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isSelected}
                      onPointerDown={(e) => {
                        shiftHeld.current = e.shiftKey
                      }}
                      onKeyDown={(e) => {
                        shiftHeld.current = e.shiftKey
                      }}
                      onCheckedChange={() => lib.toggleSelect(c.id, shiftHeld.current)}
                      aria-label={`Select ${c.title || c.filename}`}
                      className={`size-4 rounded-[4px] border-[#3A3A3A] bg-transparent transition-opacity data-[state=checked]:border-[#FF4800] data-[state=checked]:bg-[#FF4800] data-[state=checked]:text-white focus-visible:opacity-100 group-hover:opacity-100 ${
                        isSelected || selectionActive ? "opacity-100" : "opacity-0"
                      }`}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-[#F0EDE8]">
                        {c.title || c.filename}
                      </p>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-[#4A4A46]">
                      <span>{formatDate(c.converted_at)}</span>
                      {c.word_count != null && <span>{c.word_count.toLocaleString()} words</span>}
                      {(() => {
                        const project = lib.projects.find((p) => p.id === primaryProjectId(c))
                        return project ? (
                          <span className="inline-flex items-center gap-1.5 text-[#888480]">
                            <span
                              className="h-2 w-2 rounded-sm"
                              style={{ background: project.color ?? "#888480" }}
                            />
                            {project.name}
                          </span>
                        ) : null
                      })()}
                      {c.brief_generated_at && (
                        <span className="inline-flex items-center gap-1 text-[#FF4800]">
                          <Sparkles className="h-3 w-3" /> Brief
                        </span>
                      )}
                    </div>
                    {c.summary && (
                      <p className="mt-2 line-clamp-2 text-xs text-[#888480]">{c.summary}</p>
                    )}
                    {c.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {c.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-[#FF4800]/10 px-2 py-0.5 text-[10px] text-[#FF4800]"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCopy(c.id)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation()
                        handleCopy(c.id)
                      }
                    }}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#2A2A2A] text-[#4A4A46] transition-colors hover:border-[#4A4A46] hover:text-[#F0EDE8] disabled:opacity-40"
                    title="Copy markdown"
                  >
                    {copyingId === c.id && copiedId !== c.id ? (
                      <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : copiedId === c.id ? (
                      <Check className="h-3.5 w-3.5 text-[#FF4800]" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </span>
                </div>
              </div>
              )
            })}
          </div>

          {lib.hasMore && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={lib.loadMore}
                className="rounded-full border border-[#2A2A2A] px-6 py-2 text-sm text-[#888480] transition-colors hover:border-[#4A4A46] hover:text-[#F0EDE8]"
              >
                Load more
              </button>
            </div>
          )}

          {/* Bulk action bar. Sticky rather than fixed so it stays inside the list column
              and never covers the rail or the detail panel. */}
          {selectionActive && (
            <div className="sticky bottom-4 z-20 mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#2A2A2A] bg-[#161616]/95 px-4 py-2.5 shadow-[0_18px_44px_-12px_rgba(0,0,0,0.85)] backdrop-blur">
              <span className="text-sm text-[#F0EDE8]">
                {lib.selectedIds.size} selected
              </span>

              {lib.selectedIds.size < lib.spins.length && (
                <button
                  onClick={lib.selectAllVisible}
                  className="text-xs text-[#888480] underline-offset-2 transition-colors hover:text-[#F0EDE8] hover:underline"
                >
                  Select all {lib.spins.length}
                </button>
              )}

              <div className="ml-auto flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center gap-1.5 rounded-full bg-[#FF4800] px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#e04200]">
                      <FolderInput className="h-3.5 w-3.5" /> Move to…
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    side="top"
                    sideOffset={6}
                    className="max-h-80 min-w-56 overflow-y-auto rounded-xl border-[#2A2A2A] bg-[#161616] p-1 text-[#F0EDE8] shadow-[0_18px_44px_-12px_rgba(0,0,0,0.85)]"
                  >
                    <div className="truncate px-2.5 pb-1.5 pt-1 font-display text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4A4A46]">
                      Move {lib.selectedIds.size} document{lib.selectedIds.size === 1 ? "" : "s"}
                    </div>
                    {roots.map((root) => {
                      const kids = lib.projects.filter((c) => c.parent_id === root.id)
                      return (
                        <div key={root.id}>
                          <DropdownMenuItem
                            className={menuItem}
                            onSelect={() => lib.moveSelectedTo(root.id)}
                          >
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-sm"
                              style={{ background: root.color ?? "#4A4A46" }}
                              aria-hidden
                            />
                            {root.name}
                          </DropdownMenuItem>
                          {kids.map((kid) => (
                            <DropdownMenuItem
                              key={kid.id}
                              className={`${menuItem} pl-7 text-[#A8A49E]`}
                              onSelect={() => lib.moveSelectedTo(kid.id)}
                            >
                              {kid.name}
                            </DropdownMenuItem>
                          ))}
                        </div>
                      )
                    })}
                    <DropdownMenuSeparator className="mx-1 my-1 bg-[#2A2A2A]" />
                    <DropdownMenuItem className={menuItem} onSelect={() => lib.moveSelectedTo(null)}>
                      <Inbox className="h-3.5 w-3.5" /> Unfiled
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <button
                  onClick={lib.clearSelection}
                  className="rounded-full border border-[#2A2A2A] px-4 py-1.5 text-sm text-[#888480] transition-colors hover:border-[#4A4A46] hover:text-[#F0EDE8]"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
