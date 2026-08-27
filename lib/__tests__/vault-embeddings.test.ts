import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { embedTexts, embedQueryOrNull } from "@/lib/vault/embeddings"

describe("embedTexts / embedQueryOrNull", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proj.supabase.co")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key")
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("POSTs to <url>/functions/v1/embed with a Bearer service-role token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embeddings: [[0.1, 0.2]] }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await embedTexts(["hello"])

    expect(result).toEqual([[0.1, 0.2]])
    expect(fetchMock).toHaveBeenCalledWith(
      "https://proj.supabase.co/functions/v1/embed",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
        body: JSON.stringify({ texts: ["hello"] }),
      })
    )
  })

  it("returns null on a non-2xx response rather than throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }))
    expect(await embedTexts(["x"])).toBeNull()
  })

  it("returns null on a network error rather than throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")))
    expect(await embedTexts(["x"])).toBeNull()
  })

  it("returns null on a malformed response body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
    expect(await embedTexts(["x"])).toBeNull()
  })

  it("returns null without calling fetch when SUPABASE_SERVICE_ROLE_KEY is unset", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "")
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    expect(await embedTexts(["x"])).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("throws (a real bug, not a runtime hiccup) when asked to embed more than 100 texts", async () => {
    await expect(embedTexts(new Array(101).fill("x"))).rejects.toThrow(/100/)
  })

  // The backfill route embeds EMBED_REQUEST_BATCH chunks per call and the edge function
  // processes them sequentially, so it must be able to outlive the 3s search-path budget.
  it("honors a caller-supplied timeout instead of the 3s search-path default", async () => {
    vi.useFakeTimers()
    try {
      let captured: AbortSignal | undefined
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation((_url: string, init: { signal: AbortSignal }) => {
          captured = init.signal
          // never settles — this test only exercises the abort timer
          return new Promise<never>(() => {})
        })
      )

      void embedTexts(["x"], 45_000)
      await Promise.resolve()

      expect(captured?.aborted).toBe(false)
      vi.advanceTimersByTime(3_000) // past the default budget, still inside the override
      expect(captured?.aborted).toBe(false)
      vi.advanceTimersByTime(42_001) // past the override
      expect(captured?.aborted).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it("embedQueryOrNull skips the network entirely for a blank query", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    expect(await embedQueryOrNull("   ")).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("embedQueryOrNull unwraps the first embedding", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ embeddings: [[1, 2, 3]] }) }))
    expect(await embedQueryOrNull("gating")).toEqual([1, 2, 3])
  })

  it("embedQueryOrNull returns null when the underlying call fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }))
    expect(await embedQueryOrNull("gating")).toBeNull()
  })
})
