"use client"

import { useEffect, useState } from "react"
import { remark } from "remark"
import remarkGfm from "remark-gfm"
import remarkHtml from "remark-html"
import { formatDistanceToNow } from "date-fns"
import { Sparkles, RefreshCw } from "lucide-react"

export function ClusterBriefSection({
  sourceId,
  brief,
  briefGeneratedAt,
  relatedCount,
  onGenerated,
}: {
  sourceId: string
  brief: string | null
  briefGeneratedAt: string | null
  relatedCount: number
  onGenerated: (brief: string, generatedAt: string) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [html, setHtml] = useState("")

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
    } catch {
      setError("Couldn't generate a brief. Try again.")
    } finally {
      setLoading(false)
    }
  }

  const fieldLabel = "text-[10px] font-semibold uppercase tracking-wide text-[#888480]"

  // Empty state: only offer a brief when there's a cluster to synthesize across.
  if (!brief && relatedCount === 0) return null

  if (!brief) {
    return (
      <div className="space-y-1.5">
        <label className={fieldLabel}>Brief</label>
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
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className={fieldLabel}>Brief</label>
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
      </div>
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
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
