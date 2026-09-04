"use client"

import { DashboardListRow } from "@/components/dashboard/dashboard-list-row"
import { type Project, type SpinStats } from "@/lib/library"

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })

// Your curated organisation layer. Counts come from listSpinStats (the
// authoritative source — the dashboard's doc window is only the newest 50,
// so a low-activity project can still have a correct count with no date).
// A project absent from that window shows no date at all: never "never",
// never a guess.
//
// Shares DashboardListRow with RecentVault (count then date, in that order)
// so the two cards read as the same design component side by side.
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
              <DashboardListRow
                href={`/app/vault?project=${p.id}`}
                color={p.color}
                title={p.name}
                count={String(stats.byProject[p.id] ?? 0)}
                date={lastActivity[p.id] ? formatDate(lastActivity[p.id]) : undefined}
              />
            </li>
          ))}
          {stats.unfiled > 0 && (
            <li>
              <DashboardListRow
                href="/app/vault?project=unfiled"
                title="Unfiled"
                count={String(stats.unfiled)}
              />
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
