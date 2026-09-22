"use client"

import { DashboardListRow } from "@/components/dashboard/dashboard-list-row"
import { descendantProjectIds, rollUpProjectCounts, rootProjects, type Project, type SpinStats } from "@/lib/library"

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })

// Your curated organisation layer. Counts come from listSpinStats (the
// authoritative source — the dashboard's doc window is only the newest 50,
// so a low-activity project can still have a correct count with no date).
// A project absent from that window shows no date at all: never "never",
// never a guess.
//
// Shares DashboardListRow with RecentVault (count then date, in that order)
// so the two cards read as the same design component side by side. The header
// is a flex row for the same reason: as a block it would inherit the parent's
// line strut and sit ~9px taller than RecentVault's flex header. Both cards are
// h-full so the shorter list stretches to the taller one instead of ending mid-row.
//
// Only top-level projects are listed. Subprojects would otherwise show up here as
// peers of their own parent, with small counts, making the dashboard disagree with
// the Vault's folder grid — their documents are counted into the parent's row instead.
export function ProjectsRail({
  projects,
  stats,
  lastActivity,
}: {
  projects: Project[]
  stats: SpinStats
  lastActivity: Record<string, string>
}) {
  const roots = rootProjects(projects)
  const counts = rollUpProjectCounts(stats.byProject, projects)
  // Newest activity anywhere in the project, subprojects included.
  const activityOf = (rootId: string) =>
    descendantProjectIds(rootId, projects)
      .map((id) => lastActivity[id])
      .filter(Boolean)
      .sort()
      .pop()

  return (
    <div className="flex h-full flex-col rounded-xl border border-[#2A2A2A] bg-[#161616]">
      <div className="flex items-center border-b border-[#2A2A2A] px-5 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4A4A46]">
          Projects
        </span>
      </div>
      {roots.length === 0 && stats.unfiled === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-[#888480]">No projects yet.</p>
      ) : (
        <ul className="divide-y divide-[#1E1E1E]">
          {roots.map((p) => {
            const date = activityOf(p.id)
            return (
              <li key={p.id}>
                <DashboardListRow
                  href={`/app/vault?project=${p.id}`}
                  color={p.color}
                  title={p.name}
                  count={String(counts[p.id] ?? 0)}
                  date={date ? formatDate(date) : undefined}
                />
              </li>
            )
          })}
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
