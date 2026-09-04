"use client"

// Client-side drain loop for the summary backfill banner. Mirrors use-embedding-drain.ts:
// loops POSTing /api/vault/summaries/run until `remaining` hits 0, aborts on any non-2xx,
// and carries a max-iteration guard so a permanently-failing webhook can't turn into an
// infinite client-side hammer.
//
// Why this exists alongside the cron: the scheduled drain runs daily and takes 3 documents
// a tick, which is deliberately conservative but means a 60-document backlog would take
// weeks. This is the "do it now" lever — same server-side path, just driven as fast as the
// user wants rather than on a schedule.

import { useCallback, useEffect, useRef, useState } from "react"

// One document per Make webhook call at ~4.5s each, so 5 is ~23s per request — inside the
// route's maxDuration=60 with headroom.
const BATCH_LIMIT = 5
const MAX_ITERATIONS = 100
const RETRY_CHUNK = 10 // mirrors MAX_IDS in the run route
const MAX_LOG_ENTRIES = 30

export interface SummaryLogEntry {
  id: string
  label: string
  ok: boolean
  reason?: string
}

interface StatusPayload {
  pending?: number
  failed?: number
  missing?: number
  failedIds?: string[]
}

export function useSummaryDrain() {
  const [pending, setPending] = useState<number | null>(null)
  const [failed, setFailed] = useState(0)
  const [missing, setMissing] = useState(0)
  const [failedIds, setFailedIds] = useState<string[]>([])
  const [draining, setDraining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [log, setLog] = useState<SummaryLogEntry[]>([])
  const stopRef = useRef(false)

  useEffect(() => {
    fetch("/api/vault/summaries/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: StatusPayload | null) => {
        setPending(data?.pending ?? 0)
        setFailed(data?.failed ?? 0)
        setMissing(data?.missing ?? 0)
        setFailedIds(data?.failedIds ?? [])
      })
      .catch(() => setPending(0))
  }, [])

  // Stop the loop if the component unmounts mid-drain — otherwise it keeps POSTing (and
  // calling setState on an unmounted component) after the user navigates away.
  useEffect(() => {
    return () => {
      stopRef.current = true
    }
  }, [])

  const stop = useCallback(() => {
    stopRef.current = true
  }, [])

  const appendLog = useCallback((results?: SummaryLogEntry[]) => {
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
        res = await fetch("/api/vault/summaries/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: BATCH_LIMIT }),
        })
      } catch {
        setError("Network error while generating summaries.")
        break
      }
      if (!res.ok) {
        setError("Couldn't generate summaries. Try again.")
        break
      }
      const data = (await res.json()) as {
        remaining: number
        failed?: number
        results?: SummaryLogEntry[]
      }
      setPending(data.remaining)
      // Accumulate failures as they happen: a doc that fails DURING this drain would
      // otherwise leave the banner vanishing on `remaining === 0` while reporting nothing
      // wrong. A doc already marked 'failed' is never re-claimed, so this can't double-count.
      if (data.failed) setFailed((f) => f + data.failed!)
      appendLog(data.results)
      if (data.remaining <= 0) break
    }

    setDraining(false)
  }, [appendLog])

  // Bulk retry for documents that exhausted their attempt budget. Uses the {ids} path,
  // which resets/consumes attempts via claim_summaries_by_id rather than the pending gate —
  // 'failed' docs are invisible to the {limit} drain by design, so this is the only way back.
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
        res = await fetch("/api/vault/summaries/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: chunk }),
        })
      } catch {
        setError("Network error while retrying summaries.")
        break
      }
      if (!res.ok) {
        setError("Couldn't retry summaries. Try again.")
        break
      }
      const data = (await res.json()) as { results?: SummaryLogEntry[] }
      appendLog(data.results)
      const recovered = (data.results ?? []).filter((r) => r.ok).map((r) => r.id)
      if (recovered.length) {
        setFailed((f) => Math.max(0, f - recovered.length))
        setFailedIds((prev) => prev.filter((id) => !recovered.includes(id)))
      }
    }

    setDraining(false)
  }, [failedIds, appendLog])

  return { pending, failed, missing, failedIds, draining, error, log, start, stop, retryFailed }
}
