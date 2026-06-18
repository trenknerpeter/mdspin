"use client"

import { useEffect, useState } from "react"
import { FileText } from "lucide-react"
import { findRelatedSpins, mergeRelatedSpins, type RelatedSpin } from "@/lib/library"

export function RelatedSpins({
  sourceIds,
  onOpen,
  className,
}: {
  sourceIds: string[]
  onOpen?: (id: string) => void
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
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all(ids.map((id) => findRelatedSpins(id).catch(() => [] as RelatedSpin[])))
      .then((groups) => {
        if (!cancelled) setRelated(mergeRelatedSpins(groups, ids, 5))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
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
        Related in your Vault
      </p>
      <div className="space-y-1.5">
        {related.map((s) => {
          const content = (
            <>
              <FileText className="h-3.5 w-3.5 shrink-0 text-[#4A4A46]" />
              <span className="flex-1 truncate text-[#F0EDE8]">{s.title || s.filename}</span>
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
