"use client"

import { Sparkles, Square, Check, X } from "lucide-react"
import { useEmbeddingDrain } from "@/components/vault/use-embedding-drain"

// Modeled on summary-section.tsx's button/loading/error shape, but vault-wide instead of
// per-document — see this task's plan entry for why embeddings need a bulk banner and
// summaries never got one.
//
// A scheduled cron (app/api/cron/embeddings/route.ts) also drains this backlog in the
// background regardless of whether anyone opens this page, so most of the time this
// banner won't appear at all — it's a fallback / do-it-now accelerator, not the only way
// embeddings happen. The status counts it renders reflect real server state either way.
export function EmbeddingBackfillBanner() {
  const { pending, failed, draining, error, log, start, stop } = useEmbeddingDrain()
  // `pending` starts as null while the status fetch is in flight; normalize once so the
  // count comparisons below stay simple.
  const pendingCount = pending ?? 0

  // Keep the banner up once a drain has actually run in this session (log.length > 0),
  // even after pendingCount hits 0 — otherwise the checklist below vanishes the instant
  // the last document finishes, which defeats the entire point of showing it. A fresh
  // page load with nothing pending and no drain run yet still renders nothing.
  if (!pendingCount && !failed && log.length === 0) return null

  const justFinished = pendingCount === 0 && failed === 0 && log.length > 0

  return (
    <div className="mb-4 rounded-xl border border-[#2A2A2A] bg-[#161616] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-[#C9C5BE]">
          <Sparkles className="h-4 w-4 shrink-0 text-[#FF4800]" />
          <span>
            {pendingCount > 0 && (
              <>
                {pendingCount} document{pendingCount !== 1 ? "s" : ""} not yet searchable by meaning.
              </>
            )}
            {justFinished && <>All documents are now searchable by meaning.</>}
            {failed > 0 && (
              <span className="ml-2 text-red-400">{failed} failed to embed — check server logs.</span>
            )}
            {error && <span className="ml-2 text-red-400">{error}</span>}
          </span>
        </div>
        {/* Only offer the drain button when something is actually pending — a vault with
            only failures and nothing pending has no action this button can take. */}
        {pendingCount > 0 &&
          (draining ? (
            <button
              type="button"
              onClick={stop}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#2A2A2A] px-3 py-1.5 text-xs font-medium text-[#888480] transition-colors hover:border-[#4A4A46] hover:text-[#F0EDE8]"
            >
              <Square className="h-3 w-3" />
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={start}
              className="shrink-0 rounded-full bg-[#FF4800] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#e04200]"
            >
              Generate embeddings
            </button>
          ))}
      </div>
      {/* Live checklist of what the drain just did — replaces a bare countdown with
          visibility into which documents were actually processed. */}
      {log.length > 0 && (
        <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto border-t border-[#2A2A2A] pt-2">
          {[...log].reverse().map((entry, i) => (
            <li key={`${entry.id}-${i}`} className="flex items-center gap-1.5 text-xs text-[#888480]">
              {entry.ok ? (
                <Check className="h-3 w-3 shrink-0 text-[#FF4800]" />
              ) : (
                <X className="h-3 w-3 shrink-0 text-red-400" />
              )}
              <span className="truncate">{entry.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
