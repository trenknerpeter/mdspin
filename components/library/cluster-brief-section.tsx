"use client"

import { useEffect, useState } from "react"
import { remark } from "remark"
import remarkGfm from "remark-gfm"
import remarkHtml from "remark-html"
import { formatDistanceToNow } from "date-fns"
import { Sparkles, RefreshCw, Copy, Check, ChevronDown } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { InfoTooltip } from "@/components/library/info-tooltip"

export function ClusterBriefSection({
  sourceId,
  brief,
  briefGeneratedAt,
  relatedCount,
  relatedLoading = false,
  onGenerated,
}: {
  sourceId: string
  brief: string | null
  briefGeneratedAt: string | null
  relatedCount: number
  /** True while RelatedSpins is still fetching — avoids flashing the "no
   *  related docs" disabled state before the count is actually known. */
  relatedLoading?: boolean
  onGenerated: (brief: string, generatedAt: string) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [html, setHtml] = useState("")
  const [unsaved, setUnsaved] = useState(false) // brief generated but DB persist failed
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(true)

  // Clear transient warning/error state when switching to a different doc.
  useEffect(() => {
    setUnsaved(false)
    setError(null)
  }, [sourceId])

  const copyBrief = async () => {
    if (!brief) return
    await navigator.clipboard.writeText(brief)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Render markdown → html whenever the brief text changes (effect, not during render).
  useEffect(() => {
    let cancelled = false
    if (!brief) {
      setHtml("")
      return
    }
    remark()
      .use(remarkGfm)
      .use(remarkHtml)
      .process(brief)
      .then((r) => {
        if (!cancelled) setHtml(String(r))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [brief])

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId }),
      })
      const data = await res.json()
      if (!res.ok || !data.brief) {
        setError(data.message || "Couldn't generate a brief. Try again.")
        return
      }
      onGenerated(data.brief, data.brief_generated_at)
      setUnsaved(data.saved === false)
    } catch {
      setError("Couldn't generate a brief. Try again.")
    } finally {
      setLoading(false)
    }
  }

  const fieldLabel = "flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#888480]"
  const briefTooltip =
    "A synthesis across this document and others related to it in your Vault — themes, facts, and contradictions across the group."

  const header = (extra?: React.ReactNode) => (
    <div className="flex items-center justify-between">
      <CollapsibleTrigger className="hover:text-[#F0EDE8]" asChild>
        <button type="button" className={fieldLabel}>
          <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} />
          Brief
          <InfoTooltip text={briefTooltip} />
        </button>
      </CollapsibleTrigger>
      {extra}
    </div>
  )

  // Still checking for related docs — neutral placeholder, not the disabled
  // state, so a doc that turns out to have relations doesn't flash "disabled".
  if (!brief && relatedLoading) {
    return (
      <Collapsible open={open} onOpenChange={setOpen} className="space-y-1.5">
        {header()}
        <div className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#2A2A2A] bg-[#0E0E0E] px-4 py-2.5 text-sm text-[#4A4A46]">
          Checking for related documents…
        </div>
      </Collapsible>
    )
  }

  // No brief yet, and nothing to synthesize across — shown disabled with an
  // explanation rather than hidden entirely, so it's clear the feature exists
  // and why it isn't available right now.
  if (!brief && relatedCount === 0) {
    return (
      <Collapsible open={open} onOpenChange={setOpen} className="space-y-1.5">
        {header()}
        <button
          type="button"
          disabled
          className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-[#2A2A2A] bg-[#0E0E0E] px-4 py-3 text-sm font-medium text-[#4A4A46]"
        >
          <Sparkles className="h-4 w-4" />
          No related documents yet
        </button>
        <p className="text-xs text-[#4A4A46]">
          Brief needs at least one related document in your Vault to synthesize across. Add more
          documents on related topics, or tag this one to help it match.
        </p>
      </Collapsible>
    )
  }

  if (!brief) {
    return (
      <Collapsible open={open} onOpenChange={setOpen} className="space-y-1.5">
        {header()}
        <CollapsibleContent className="space-y-1.5">
          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#FF4800]/40 bg-[#FF4800]/[0.06] px-4 py-3 text-sm font-medium text-[#FF4800] transition-colors hover:bg-[#FF4800]/[0.12] disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {loading ? "Synthesizing…" : `Synthesize a brief from ${relatedCount} related doc${relatedCount !== 1 ? "s" : ""}`}
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </CollapsibleContent>
      </Collapsible>
    )
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="space-y-1.5">
      {header(
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-1 text-[10px] text-[#888480] transition-colors hover:text-[#F0EDE8] disabled:opacity-50"
          title="Regenerate brief"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Regenerating…" : "Regenerate"}
        </button>
      )}
      <CollapsibleContent className="space-y-1.5">
        <div className="rounded-lg border border-[#FF4800]/30 bg-[#FF4800]/[0.04] p-4">
          <div
            className="prose prose-invert prose-sm max-w-none text-[#C9C5BE] [&_a]:text-[#FF4800] [&_code]:text-[#F0EDE8] [&_h1]:text-[#F0EDE8] [&_h2]:text-[#F0EDE8] [&_h3]:text-[#F0EDE8] [&_strong]:text-[#F0EDE8]"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          {briefGeneratedAt && (
            <p className="mt-3 border-t border-[#FF4800]/15 pt-2 text-[10px] text-[#4A4A46]">
              Generated {formatDistanceToNow(new Date(briefGeneratedAt), { addSuffix: true })}
            </p>
          )}
        </div>
        {unsaved && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2">
            <span className="text-xs text-yellow-300">Generated but couldn&apos;t save — copy it before closing.</span>
            <button
              type="button"
              onClick={copyBrief}
              className="flex shrink-0 items-center gap-1 text-xs font-medium text-[#F0EDE8] hover:underline"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-[#FF4800]" /> : <Copy className="h-3.5 w-3.5" />} Copy
            </button>
          </div>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </CollapsibleContent>
    </Collapsible>
  )
}
