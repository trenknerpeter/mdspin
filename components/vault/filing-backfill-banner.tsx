"use client"

import { GitBranch, Square, Check, AlertCircle, X } from "lucide-react"
import { useFilingDrain } from "@/components/vault/use-filing-drain"

// Filing backfill for GitHub-synced documents. Modelled on summary-backfill-banner.tsx,
// but unlike that one there is NO scheduled cron backstop (see the design doc's "backfill
// is a manual step" decision) — this banner is the only way an existing Unfiled backlog
// gets classified. New pushes going forward are filed inline by the webhook itself and
// never show up here at all.
export function FilingBackfillBanner() {
  const { pending, failed, draining, error, log, start, stop, retryFailed } = useFilingDrain()
  const pendingCount = pending ?? 0

  if (!pendingCount && !failed && log.length === 0) return null

  const justFinished = pendingCount === 0 && failed === 0 && log.length > 0

  return (
    <div className="mb-4 rounded-xl border border-[#2A2A2A] bg-[#161616] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-[#C9C5BE]">
          <GitBranch className="h-4 w-4 shrink-0 text-[#FF4800]" />
          <span>
            {pendingCount > 0 && (
              <>
                {pendingCount} GitHub document{pendingCount !== 1 ? "s" : ""} waiting to be filed.
              </>
            )}
            {justFinished && <>Every waiting document has been filed or flagged for review.</>}
            {failed > 0 && <span className="ml-2 text-red-400">{failed} couldn&apos;t be filed.</span>}
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
                  File everything now
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
              {entry.outcome === "filed" && <Check className="h-3 w-3 shrink-0 text-[#FF4800]" />}
              {entry.outcome === "flagged" && <AlertCircle className="h-3 w-3 shrink-0 text-amber-400" />}
              {entry.outcome === "failed" && <X className="h-3 w-3 shrink-0 text-red-400" />}
              <span className="truncate">{entry.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
