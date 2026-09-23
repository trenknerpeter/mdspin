"use client"

import { Folder, Inbox } from "lucide-react"
import type { FolderSummary } from "@/lib/library"

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })

export interface FolderCardProps {
  summary: FolderSummary
  /** Display name; the Unfiled card passes "Unfiled". */
  name: string
  color: string | null
  /** Subprojects inside this one, shown as chips. */
  subProjects?: { id: string; name: string; count: number }[]
  /** One-line project summary. Undefined until the summary pipeline covers projects —
   *  the card renders nothing rather than a placeholder. */
  summaryLine?: string | null
  /** True when the GitHub auto-filing classifier created this project itself, and it's
   *  young enough that the badge is still worth showing (see isRecentlyAutoCreated). */
  isNew?: boolean
  onOpen: () => void
  onOpenSubProject?: (id: string) => void
}

export function FolderCard({
  summary,
  name,
  color,
  subProjects = [],
  summaryLine,
  isNew,
  onOpen,
  onOpenSubProject,
}: FolderCardProps) {
  const isUnfiled = summary.projectId === null
  const Icon = isUnfiled ? Inbox : Folder

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen()
        }
      }}
      className="flex cursor-pointer flex-col rounded-xl border border-[#2A2A2A] bg-[#161616] p-4 text-left transition-colors hover:border-[#3A3A3A] focus:border-[#4A4A46] focus:outline-none"
    >
      <div className="flex items-center gap-2">
        {isUnfiled ? (
          <Icon className="h-4 w-4 shrink-0 text-[#4A4A46]" />
        ) : (
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ background: color ?? "#4A4A46" }}
          />
        )}
        <p className="truncate text-sm font-medium text-[#F0EDE8]">{name}</p>
        {isNew && (
          <span className="shrink-0 rounded-full bg-[#FF4800]/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#FF4800]">
            New
          </span>
        )}
      </div>

      <div className="mt-1 flex items-center gap-2 text-xs text-[#4A4A46]">
        <span>
          {summary.count} document{summary.count !== 1 ? "s" : ""}
        </span>
        {summary.lastActivity && (
          <>
            <span aria-hidden>·</span>
            <span>updated {fmtDate(summary.lastActivity)}</span>
          </>
        )}
      </div>

      {summaryLine && (
        <p className="mt-2 line-clamp-2 text-xs text-[#888480]">{summaryLine}</p>
      )}

      {subProjects.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {subProjects.map((sp) => (
            <button
              key={sp.id}
              onClick={(e) => {
                e.stopPropagation()
                onOpenSubProject?.(sp.id)
              }}
              className="inline-flex items-center gap-1 rounded-full border border-[#2A2A2A] px-2 py-0.5 text-[10px] text-[#888480] transition-colors hover:border-[#4A4A46] hover:text-[#F0EDE8]"
            >
              <Folder className="h-2.5 w-2.5" />
              {sp.name}
              <span className="text-[#4A4A46]">{sp.count}</span>
            </button>
          ))}
        </div>
      )}

      {summary.recentTitles.length > 0 && (
        <ul className="mt-3 space-y-0.5 border-t border-[#2A2A2A] pt-2.5">
          {summary.recentTitles.map((t, i) => (
            <li key={i} className="truncate text-[11px] text-[#4A4A46]">
              {t}
            </li>
          ))}
        </ul>
      )}

      {summary.count === 0 && (
        <p className="mt-3 border-t border-[#2A2A2A] pt-2.5 text-[11px] text-[#4A4A46]">
          Empty — nothing filed here yet.
        </p>
      )}
    </div>
  )
}
