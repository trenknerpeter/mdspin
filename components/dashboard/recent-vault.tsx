"use client"

import Link from "next/link"
import { FileText, ArrowRight } from "lucide-react"
import { primaryProjectId, type Spin, type Project } from "@/lib/library"

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })

// Vault-scoped replacement for the old all-conversions "Recent spins" rail.
// Preview line is title/filename only — never s.summary. Every doc in the
// live vault currently has summary_status "pending", so a summary-dependent
// preview would just show blank rows.
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
                <Link
                  href={`/app/vault?spin=${s.id}`}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[#1A1A1A]"
                >
                  <FileText className="h-4 w-4 shrink-0 text-[#4A4A46]" />
                  <span className="min-w-0 flex-1 truncate text-sm text-[#F0EDE8]">
                    {s.title || s.filename}
                  </span>
                  {s.word_count != null && (
                    <span className="shrink-0 text-xs text-[#4A4A46]">
                      {s.word_count.toLocaleString()} words
                    </span>
                  )}
                  {project && (
                    <span
                      className="h-2 w-2 shrink-0 rounded-sm"
                      style={{ background: project.color ?? "#888480" }}
                      title={project.name}
                    />
                  )}
                  <span className="shrink-0 text-xs text-[#4A4A46]">
                    {formatDate(s.converted_at)}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
