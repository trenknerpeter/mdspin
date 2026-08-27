"use client"

import { Sparkles, Square } from "lucide-react"
import { useEmbeddingDrain } from "@/components/vault/use-embedding-drain"

// Modeled on summary-section.tsx's button/loading/error shape, but vault-wide instead of
// per-document — see this task's plan entry for why embeddings need a bulk banner and
// summaries never got one.
export function EmbeddingBackfillBanner() {
  const { pending, draining, error, start, stop } = useEmbeddingDrain()

  if (!pending) return null

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[#2A2A2A] bg-[#161616] px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-[#C9C5BE]">
        <Sparkles className="h-4 w-4 shrink-0 text-[#FF4800]" />
        <span>
          {pending} document{pending !== 1 ? "s" : ""} not yet searchable by meaning.
          {error && <span className="ml-2 text-red-400">{error}</span>}
        </span>
      </div>
      {draining ? (
        <button
          type="button"
          onClick={stop}
          className="flex items-center gap-1.5 rounded-full border border-[#2A2A2A] px-3 py-1.5 text-xs font-medium text-[#888480] transition-colors hover:border-[#4A4A46] hover:text-[#F0EDE8]"
        >
          <Square className="h-3 w-3" />
          Stop
        </button>
      ) : (
        <button
          type="button"
          onClick={start}
          className="rounded-full bg-[#FF4800] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#e04200]"
        >
          Generate embeddings
        </button>
      )}
    </div>
  )
}
