"use client"

// Client-side drain loop for the filing backfill banner. Mirrors use-summary-drain.ts:
// loops POSTing /api/vault/filing/run until `remaining` hits 0, aborts on any non-2xx, and
// carries a max-iteration guard so a permanently-failing webhook can't turn into an
// infinite client-side hammer.
//
// Unlike summaries, there is no cron fallback for filing (see the design doc's "backfill is
// a manual, user-triggered step" decision) -- this drain loop and the webhook's own inline
// drain for brand-new pushes are the only two places a document ever actually gets filed.

import { useCallback, useEffect, useRef, useState } from "react"

const BATCH_LIMIT = 5
const MAX_ITERATIONS = 100
const RETRY_CHUNK = 10 // mirrors MAX_IDS in the run route
const MAX_LOG_ENTRIES = 30

export type FilingOutcome = "filed" | "flagged" | "failed"

export interface FilingLogEntry {
  id: string
  label: string
  ok: boolean
  outcome: FilingOutcome
  reason?: string
}

interface StatusPayload {
  pending?: number
  failed?: number
  failedIds?: string[]
}

export function useFilingDrain() {
  const [pending, setPending] = useState<number | null>(null)
  const [failed, setFailed] = useState(0)
  const [failedIds, setFailedIds] = useState<string[]>([])
  const [draining, setDraining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [log, setLog] = useState<FilingLogEntry[]>([])
  const stopRef = useRef(false)

  useEffect(() => {
    fetch("/api/vault/filing/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: StatusPayload | null) => {
        setPending(data?.pending ?? 0)
        setFailed(data?.failed ?? 0)
        setFailedIds(data?.failedIds ?? [])
      })
      .catch(() => setPending(0))
  }, [])

  useEffect(() => {
    return () => {
      stopRef.current = true
    }
  }, [])

  const stop = useCallback(() => {
    stopRef.current = true
  }, [])

  const appendLog = useCallback((results?: FilingLogEntry[]) => {
    if (results?.length) setLog((prev) => [...prev, ...results].slice(-MAX_LOG_ENTRIES))
  }, [])

  const start = useCallback(async () => {
    stopRef.current = false
    setDraining(true)
    setError(null)
    setLog([])

    for (let i = 0; i < MAX_ITERATIONS && !stopRef.current; i++) {
      let res: Response
      try {
        res = await fetch("/api/vault/filing/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: BATCH_LIMIT }),
        })
      } catch {
        setError("Network error while filing documents.")
        break
      }
      if (!res.ok) {
        setError("Couldn't file documents. Try again.")
        break
      }
      const data = (await res.json()) as { remaining: number; failed?: number; results?: FilingLogEntry[] }
      setPending(data.remaining)
      if (data.failed) setFailed((f) => f + data.failed!)
      appendLog(data.results)
      if (data.remaining <= 0) break
    }

    setDraining(false)
  }, [appendLog])

  const retryFailed = useCallback(async () => {
    if (failedIds.length === 0) return
    stopRef.current = false
    setDraining(true)
    setError(null)
    setLog([])

    for (let i = 0; i < failedIds.length && !stopRef.current; i += RETRY_CHUNK) {
      const chunk = failedIds.slice(i, i + RETRY_CHUNK)
      let res: Response
      try {
        res = await fetch("/api/vault/filing/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: chunk }),
        })
      } catch {
        setError("Network error while retrying filing.")
        break
      }
      if (!res.ok) {
        setError("Couldn't retry filing. Try again.")
        break
      }
      const data = (await res.json()) as { results?: FilingLogEntry[] }
      appendLog(data.results)
      const recovered = (data.results ?? []).filter((r) => r.ok).map((r) => r.id)
      if (recovered.length) {
        setFailed((f) => Math.max(0, f - recovered.length))
        setFailedIds((prev) => prev.filter((id) => !recovered.includes(id)))
      }
    }

    setDraining(false)
  }, [failedIds, appendLog])

  return { pending, failed, failedIds, draining, error, log, start, stop, retryFailed }
}
