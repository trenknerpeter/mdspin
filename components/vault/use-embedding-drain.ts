"use client"

// Client-side drain loop for the embedding backfill banner. Loops POSTing
// /api/vault/embeddings/run with a fixed batch size until `remaining` hits 0, aborts on
// any non-2xx response, and carries a max-iteration guard — a misconfigured edge function
// returning e.g. a permanent 503 must not turn into an infinite client-side hammer.

import { useCallback, useEffect, useRef, useState } from "react"

const BATCH_LIMIT = 5
const MAX_ITERATIONS = 100

export function useEmbeddingDrain() {
  const [pending, setPending] = useState<number | null>(null)
  const [draining, setDraining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stopRef = useRef(false)

  useEffect(() => {
    fetch("/api/vault/embeddings/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { pending?: number } | null) => setPending(data?.pending ?? 0))
      .catch(() => setPending(0))
  }, [])

  const stop = useCallback(() => {
    stopRef.current = true
  }, [])

  const start = useCallback(async () => {
    stopRef.current = false
    setDraining(true)
    setError(null)

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
      const data = (await res.json()) as { remaining: number }
      setPending(data.remaining)
      if (data.remaining <= 0) break
    }

    setDraining(false)
  }, [])

  return { pending, draining, error, start, stop }
}
