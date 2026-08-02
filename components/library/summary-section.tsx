"use client"

import { useState } from "react"
import { Sparkles, RefreshCw, ChevronDown } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { InfoTooltip } from "@/components/library/info-tooltip"
import type { SummaryStatus } from "@/lib/vault/summary"

// Modeled on cluster-brief-section.tsx, but summaries are single-doc and
// one-shot (no cross-document synthesis), so there's no "empty state needs a
// cluster" gate — every vault doc is eligible.
export function SummarySection({
  spinId,
  summary,
  status,
  onGenerated,
}: {
  spinId: string
  summary: string | null
  status: SummaryStatus | null
  onGenerated: (fields: { summary: string; summary_status: SummaryStatus; summary_generated_at: string }) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(true)

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/vault/summaries/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [spinId] }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || "Couldn't generate a summary. Try again.")
        return
      }
      const own = (data.summaries as { id: string; summary: string }[] | undefined)?.find(
        (s) => s.id === spinId
      )
      if (!own) {
        setError("Couldn't generate a summary. Try again.")
        return
      }
      onGenerated({
        summary: own.summary,
        summary_status: "ready",
        summary_generated_at: data.summary_generated_at,
      })
    } catch {
      setError("Couldn't generate a summary. Try again.")
    } finally {
      setLoading(false)
    }
  }

  const fieldLabel = "flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#888480]"

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="space-y-1.5">
      <div className="flex items-center justify-between">
        <CollapsibleTrigger className="flex items-center gap-1.5 hover:text-[#F0EDE8]" asChild>
          <button type="button" className={fieldLabel}>
            <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} />
            Summary
            <InfoTooltip text="A short automatic summary of just this document." />
          </button>
        </CollapsibleTrigger>
        {summary && (
          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-1 text-[10px] text-[#888480] transition-colors hover:text-[#F0EDE8] disabled:opacity-50"
            title="Regenerate summary"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Regenerating…" : "Regenerate"}
          </button>
        )}
      </div>

      <CollapsibleContent className="space-y-1.5">
        {!summary ? (
          <>
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#2A2A2A] bg-[#0E0E0E] px-4 py-2.5 text-sm font-medium text-[#888480] transition-colors hover:border-[#4A4A46] hover:text-[#F0EDE8] disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {loading ? "Summarizing…" : status === "failed" ? "Retry summary" : "Generate summary"}
            </button>
            {error && <p className="text-sm text-red-400">{error}</p>}
          </>
        ) : (
          <>
            <p className="rounded-lg border border-[#2A2A2A] bg-[#0E0E0E] p-3 text-sm leading-relaxed text-[#C9C5BE]">
              {summary}
            </p>
            {error && <p className="text-sm text-red-400">{error}</p>}
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
