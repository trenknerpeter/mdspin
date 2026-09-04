"use client"

import Link from "next/link"
import { Inbox } from "lucide-react"
import { type Project, type SpinStats } from "@/lib/library"

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })

// Your curated organisation layer. Counts come from listSpinStats (the
// authoritative source — the dashboard's doc window is only the newest 50,
// so a low-activity project can still have a correct count with no date).
// A project absent from that window shows no date at all: never "never",
// never a guess.
export function ProjectsRail({
  projects,
  stats,
  lastActivity,
}: {
  projects: Project[]
  stats: SpinStats
  lastActivity: Record<string, string>
}) {
  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#161616]">
      <div className="border-b border-[#2A2A2A] px-5 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4A4A46]">
          Projects
        </span>
      </div>
      {projects.length === 0 && stats.unfiled === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-[#888480]">No projects yet.</p>
      ) : (
        <ul className="divide-y divide-[#1E1E1E]">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/app/vault?project=${p.id}`}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[#1A1A1A]"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: p.color ?? "#4A4A46" }}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-[#F0EDE8]">{p.name}</span>
                {lastActivity[p.id] && (
                  <span className="shrink-0 text-xs text-[#4A4A46]">
                    {formatDate(lastActivity[p.id])}
                  </span>
                )}
                <span className="shrink-0 text-xs text-[#888480]">
                  {stats.byProject[p.id] ?? 0}
                </span>
              </Link>
            </li>
          ))}
          {stats.unfiled > 0 && (
            <li>
              <Link
                href="/app/vault?project=unfiled"
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[#1A1A1A]"
              >
                <Inbox className="h-3.5 w-3.5 shrink-0 text-[#4A4A46]" />
                <span className="min-w-0 flex-1 truncate text-sm text-[#F0EDE8]">Unfiled</span>
                <span className="shrink-0 text-xs text-[#888480]">{stats.unfiled}</span>
              </Link>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
