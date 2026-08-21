"use client"

import { useEffect, useState } from "react"
import { FileText } from "lucide-react"
import { findRelatedSpins, mergeRelatedSpins, type RelatedSpin } from "@/lib/library"

/** Affinity beacon. Project membership already says "these belong together"; the beacon
 *  says how tightly, so a loose member of a tight project reads as loose instead of equal. */
const STRENGTH = {
  strong: { label: "Strong", dot: "bg-[#FF4800]", text: "text-[#FF7A4D]" },
  medium: { label: "Medium", dot: "bg-[#E0B341]", text: "text-[#C9A03B]" },
  weak: { label: "Weak", dot: "bg-[#4A4A46]", text: "text-[#888480]" },
} as const

export function RelatedSpins({
  sourceIds,
  onOpen,
  onCount,
  onLoadingChange,
  className,
}: {
  sourceIds: string[]
  onOpen?: (id: string) => void
  onCount?: (n: number) => void
  /** Lets callers (e.g. ClusterBriefSection) distinguish "still checking" from
   *  "confirmed zero related docs" — onCount alone can't tell those apart. */
  onLoadingChange?: (loading: boolean) => void
  className?: string
}) {
  const [related, setRelated] = useState<RelatedSpin[]>([])
  const [loading, setLoading] = useState(true)
  const key = sourceIds.filter(Boolean).join(",")

  useEffect(() => {
    let cancelled = false
    const ids = sourceIds.filter(Boolean)
    if (ids.length === 0) {
      setRelated([])
      onCount?.(0)
      setLoading(false)
      onLoadingChange?.(false)
      return
    }
    setLoading(true)
    onLoadingChange?.(true)
    Promise.all(ids.map((id) => findRelatedSpins(id).catch(() => [] as RelatedSpin[])))
      .then((groups) => {
        if (cancelled) return
        const merged = mergeRelatedSpins(groups, ids, 10)
        setRelated(merged)
        onCount?.(merged.length)
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
          onLoadingChange?.(false)
        }
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // No empty box on cold start / no matches.
  if (loading || related.length === 0) return null

  return (
    <div className={className}>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#888480]">
        Related in this project
      </p>
      <div className="space-y-1.5">
        {related.map((s) => {
          const badge = s.strength ? STRENGTH[s.strength] : null
          const content = (
            <>
              <FileText className="h-3.5 w-3.5 shrink-0 text-[#4A4A46]" />
              <span className="flex-1 truncate text-[#F0EDE8]">{s.title || s.filename}</span>
              {badge && (
                <span
                  className={`flex shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide ${badge.text}`}
                  title={`${badge.label} affinity — how much content this shares with the open document`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                  {badge.label}
                </span>
              )}
              {s.word_count != null && (
                <span className="shrink-0 text-xs text-[#4A4A46]">
                  {s.word_count.toLocaleString()} words
                </span>
              )}
            </>
          )
          const cls =
            "flex w-full items-center gap-2 rounded-lg border border-[#2A2A2A] bg-[#0E0E0E] px-3 py-2 text-left text-sm transition-colors hover:border-[#4A4A46]"
          return onOpen ? (
            <button key={s.id} type="button" title={`Open ${s.title || s.filename}`} onClick={() => onOpen(s.id)} className={cls}>
              {content}
            </button>
          ) : (
            <a key={s.id} title={`Open ${s.title || s.filename}`} href={`/app/vault?spin=${s.id}`} className={cls}>
              {content}
            </a>
          )
        })}
      </div>
    </div>
  )
}
