"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { DashboardListRow } from "@/components/dashboard/dashboard-list-row"
import { primaryProjectId, type Spin, type Project } from "@/lib/library"

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })

// Vault-scoped replacement for the old all-conversions "Recent spins" rail.
// Preview line is title/filename only — never s.summary. Every doc in the
// live vault currently has summary_status "pending", so a summary-dependent
// preview would just show blank rows.
//
// Shares DashboardListRow with ProjectsRail (count then date, in that order,
// leading dot = the doc's primary project color) so the two cards read as
// the same design component side by side.
export function RecentVault({ docs, projects }: { docs: Spin[]; projects: Project[] }) {
  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#161616]">
      <div className="flex items-center justify-between border-b border-[#2A2A2A] px-5 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4A4A46]">
          Recently added to Vault
        </span>
        <Link
          href="/app/vault"
          className="inline-flex items-center gap-1 text-[10px] text-[#888480] transition-colors hover:text-[#F0EDE8]"
        >
          View vault <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {docs.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-[#888480]">
          Nothing in the Vault yet.
        </p>
      ) : (
        <ul className="divide-y divide-[#1E1E1E]">
          {docs.slice(0, 6).map((s) => {
            const project = projects.find((p) => p.id === primaryProjectId(s))
            return (
              <li key={s.id}>
                <DashboardListRow
                  href={`/app/vault?spin=${s.id}`}
                  color={project?.color}
                  title={s.title || s.filename}
                  count={s.word_count != null ? `${s.word_count.toLocaleString()} words` : undefined}
                  date={formatDate(s.converted_at)}
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
