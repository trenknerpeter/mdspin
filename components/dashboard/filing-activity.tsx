"use client"

import Link from "next/link"
import { GitBranch, ArrowRight } from "lucide-react"
import { primaryProjectId, type Spin, type Project } from "@/lib/library"

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })

// Surfaces what the GitHub auto-filing classifier has done lately, so a document never
// lands (or a project never gets created) silently. Pull-based off the same `vaultDocs`
// window use-dashboard.ts already fetches for RecentVault/VaultPulse — no dedicated
// query, since a freshly filed/flagged row's updated_at puts it at the front of that
// window already. Renders nothing when there's no GitHub filing activity to report,
// rather than an empty card nobody asked to see.
export function FilingActivity({ docs, projects }: { docs: Spin[]; projects: Project[] }) {
  const activity = docs
    .filter((d) => d.source_type === "sync" && (d.filing_status === "filed" || d.filing_status === "flagged"))
    .slice(0, 6)

  if (activity.length === 0) return null

  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#161616]">
      <div className="flex items-center justify-between border-b border-[#2A2A2A] px-5 py-3">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4A4A46]">
          <GitBranch className="h-3 w-3" />
          GitHub filing activity
        </span>
        <Link
          href="/app/vault?project=unfiled"
          className="inline-flex items-center gap-1 text-[10px] text-[#888480] transition-colors hover:text-[#F0EDE8]"
        >
          View Unfiled <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <ul className="divide-y divide-[#1E1E1E]">
        {activity.map((s) => {
          const filed = s.filing_status === "filed"
          const project = filed ? projects.find((p) => p.id === primaryProjectId(s)) : null
          return (
            <li key={s.id}>
              <Link
                href={`/app/vault?spin=${s.id}`}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[#1A1A1A]"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: filed ? project?.color ?? "#4A4A46" : "#D97706" }}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-[#F0EDE8]">
                  {s.title || s.filename}
                </span>
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                    filed ? "bg-[#FF4800]/15 text-[#FF4800]" : "bg-amber-400/15 text-amber-400"
                  }`}
                >
                  {filed ? `Filed → ${project?.name ?? "project"}` : "Needs review"}
                </span>
                <span className="shrink-0 text-right text-xs text-[#4A4A46] min-w-[3.5rem]">
                  {formatDate(s.updated_at)}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
