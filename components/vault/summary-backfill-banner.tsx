"use client"

import { FileText, Square, Check, X } from "lucide-react"
import { useSummaryDrain } from "@/components/vault/use-summary-drain"

// Vault-wide summary backfill, modelled on embedding-backfill-banner.tsx.
//
// A scheduled cron (app/api/cron/summaries/route.ts) also drains this backlog in the
// background regardless of whether anyone opens this page, so most of the time this banner
// won't appear at all — it's a do-it-now accelerator, not the only way summaries happen.
// It matters more than the embedding one though: the cron takes 3 documents a day, so a
// large backlog would otherwise take weeks to clear.
export function SummaryBackfillBanner() {
  const { pending, failed, missing, draining, error, log, start, stop, retryFailed } = useSummaryDrain()
  const pendingCount = pending ?? 0

  // Keep the banner up once a drain has actually run in this session, even after the count
  // hits 0 — otherwise the checklist vanishes the instant the last document finishes.
  if (!pendingCount && !failed && !missing && log.length === 0) return null

  const justFinished = pendingCount === 0 && failed === 0 && log.length > 0

  return (
    <div className="mb-4 rounded-xl border border-[#2A2A2A] bg-[#161616] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-[#C9C5BE]">
          <FileText className="h-4 w-4 shrink-0 text-[#FF4800]" />
          <span>
            {pendingCount > 0 && (
              <>
                {pendingCount} document{pendingCount !== 1 ? "s" : ""} waiting for a summary.
              </>
            )}
            {justFinished && <>Every document now has a summary.</>}
            {failed > 0 && (
              <span className="ml-2 text-red-400">{failed} couldn&apos;t be summarized.</span>
            )}
            {/* Should always be 0: every write path enqueues, and summary_status has a
                database default. If this ever shows a number, a new write path has skipped
                the column and those documents are invisible to the drainer. */}
            {missing > 0 && (
              <span className="ml-2 text-red-400">
                {missing} never queued — report this.
              </span>
            )}
            {error && <span className="ml-2 text-red-400">{error}</span>}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
            <>
              {/* 'failed' docs are never re-claimed by the {limit} drain, so they need
                  their own lever — otherwise they're stranded with no way back. */}
              {failed > 0 && (
                <button
                  type="button"
                  onClick={retryFailed}
                  className="rounded-full border border-[#2A2A2A] px-3 py-1.5 text-xs font-medium text-[#888480] transition-colors hover:border-[#4A4A46] hover:text-[#F0EDE8]"
                >
                  Retry failed
                </button>
              )}
              {pendingCount > 0 && (
                <button
                  type="button"
                  onClick={start}
                  className="rounded-full bg-[#FF4800] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#e04200]"
                >
                  Summarize everything now
                </button>
              )}
            </>
          )}
        </div>
      </div>
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
