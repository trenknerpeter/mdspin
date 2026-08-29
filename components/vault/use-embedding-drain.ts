"use client"

// Client-side drain loop for the embedding backfill banner. Loops POSTing
// /api/vault/embeddings/run with a fixed batch size until `remaining` hits 0, aborts on
// any non-2xx response, and carries a max-iteration guard — a misconfigured edge function
// returning e.g. a permanent 503 must not turn into an infinite client-side hammer.

import { useCallback, useEffect, useRef, useState } from "react"

const BATCH_LIMIT = 5
const MAX_ITERATIONS = 100
// Caps the rendered log, not what's tracked server-side — a large backfill can process
// hundreds of documents in one drain; keeping only the most recent entries in the DOM
// avoids an unbounded list for no benefit (older entries scroll out of relevance fast).
const MAX_LOG_ENTRIES = 30

export interface EmbedLogEntry {
  id: string
  label: string
  ok: boolean
}

export function useEmbeddingDrain() {
  const [pending, setPending] = useState<number | null>(null)
  const [failed, setFailed] = useState(0)
  const [draining, setDraining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [log, setLog] = useState<EmbedLogEntry[]>([])
  const stopRef = useRef(false)

  useEffect(() => {
    fetch("/api/vault/embeddings/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { pending?: number; failed?: number } | null) => {
        setPending(data?.pending ?? 0)
        setFailed(data?.failed ?? 0)
      })
      .catch(() => setPending(0))
  }, [])

  // Stop the drain loop if the component unmounts mid-drain — otherwise the loop keeps
  // POSTing (and calling setState on an unmounted component) after the user navigates away.
  useEffect(() => {
    return () => {
      stopRef.current = true
    }
  }, [])

  const stop = useCallback(() => {
    stopRef.current = true
  }, [])

  const start = useCallback(async () => {
    stopRef.current = false
    setDraining(true)
    setError(null)
    setLog([])

    for (let i = 0; i < MAX_ITERATIONS && !stopRef.current; i++) {
      let res: Response
      try {
        res = await fetch("/api/vault/embeddings/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: BATCH_LIMIT }),
        })
      } catch {
        setError("Network error while generating embeddings.")
        break
      }
      if (!res.ok) {
        setError("Couldn't generate embeddings. Try again.")
        break
      }
      const data = (await res.json()) as {
        remaining: number
        failed?: number
        results?: EmbedLogEntry[]
      }
      setPending(data.remaining)
      // Accumulate failures as they happen, not just at mount: a doc that fails DURING
      // this drain would otherwise leave the banner vanishing on `remaining === 0` while
      // reporting nothing wrong. A doc already marked 'failed' is never re-claimed by
      // claim_pending_embeddings, so adding each batch's count can't double-count.
      const batchFailed = data.failed ?? 0
      if (batchFailed > 0) setFailed((f) => f + batchFailed)
      if (data.results?.length) {
        setLog((prev) => [...prev, ...data.results!].slice(-MAX_LOG_ENTRIES))
      }
      if (data.remaining <= 0) break
    }

    setDraining(false)
  }, [])

  return { pending, failed, draining, error, log, start, stop }
}
