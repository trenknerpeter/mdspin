import { describe, it, expect, vi } from "vitest"
import { summarizeAndStoreDocument, type SummarizableDoc } from "@/lib/vault/summarize-document"
import { SUMMARY_DELIMITER } from "@/lib/vault/summary"

// Purpose-built fake of the two supabase-js chains this module uses:
//   .from("conversions").update(patch).eq("id", id)
//   .from("conversions").select("summary_attempts").eq("id", id).maybeSingle()
// Deliberately local rather than reusing vault-repo.test.ts's FakeClient: that one has no
// .maybeSingle-with-result support for a *second* differing table read, and widening it
// would churn a 700-line test file for no gain here.
class FakeChain {
  constructor(
    public record: { patch?: unknown; eq?: unknown[]; select?: string },
    private result: unknown
  ) {}
  eq(...args: unknown[]) {
    this.record.eq = args
    return this
  }
  maybeSingle() {
    return this
  }
  then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
    return Promise.resolve(this.result).then(resolve, reject)
  }
}

class FakeSupabase {
  updates: { patch: Record<string, unknown>; eq?: unknown[] }[] = []
  selects: { select: string; eq?: unknown[] }[] = []
  constructor(private attemptsRow: unknown = { summary_attempts: 0 }) {}
  from(_table: string) {
    return {
      update: (patch: Record<string, unknown>) => {
        const rec: { patch: Record<string, unknown>; eq?: unknown[] } = { patch }
        this.updates.push(rec)
        return new FakeChain(rec, { error: null })
      },
      select: (cols: string) => {
        const rec: { select: string; eq?: unknown[] } = { select: cols }
        this.selects.push(rec)
        return new FakeChain(rec, { data: this.attemptsRow })
      },
    }
  }
}

const doc: SummarizableDoc = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Test Doc",
  filename: "test.md",
  markdown_text: "# Test Doc\n\nSome body text about knowledge vaults and summaries.",
}

const deps = (fetchImpl: unknown) => ({
  webhookUrl: "https://hook.example.com/abc",
  webhookSecret: "s3cret",
  fetchImpl: fetchImpl as typeof fetch,
  now: () => "2026-09-04T00:00:00.000Z",
})

const okResponse = (body: string) =>
  ({ ok: true, status: 200, text: async () => body }) as unknown as Response

const goodBody = `${doc.id}${SUMMARY_DELIMITER}A short summary of the test document.`

describe("summarizeAndStoreDocument", () => {
  it("stores the summary and marks the document ready on success", async () => {
    const db = new FakeSupabase()
    const res = await summarizeAndStoreDocument(db as never, doc, deps(vi.fn(async () => okResponse(goodBody))))

    expect(res.ok).toBe(true)
    expect(res.summary).toBe("A short summary of the test document.")
    expect(db.updates).toHaveLength(1)
    expect(db.updates[0].patch).toEqual({
      summary: "A short summary of the test document.",
      summary_status: "ready",
      summary_generated_at: "2026-09-04T00:00:00.000Z",
    })
    expect(db.updates[0].eq).toEqual(["id", doc.id])
  })

  it("sends the shared secret and exactly one document per call", async () => {
    const fetchImpl = vi.fn(async () => okResponse(goodBody))
    await summarizeAndStoreDocument(new FakeSupabase() as never, doc, deps(fetchImpl))

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://hook.example.com/abc")
    expect((init.headers as Record<string, string>)["x-mdspin-secret"]).toBe("s3cret")
    const body = JSON.parse(init.body as string)
    // The Make scenario handles exactly one doc per call — batching would need an
    // Iterator + Aggregator on the Make side. See SUMMARY_BATCH_SIZE in lib/vault/limits.ts.
    expect(body.docs).toHaveLength(1)
    expect(body.docs[0].id).toBe(doc.id)
    expect(typeof body.maxWords).toBe("number")
  })

  // THE regression guard. A Make filter that blocks a request still answers HTTP 200 with
  // the body "Accepted" — verified against the live scenario. Storing that as a summary
  // would silently fill the vault with the word "Accepted".
  it("never stores Make's blocked-request acknowledgement as a summary", async () => {
    const db = new FakeSupabase({ summary_attempts: 1 })
    const res = await summarizeAndStoreDocument(db as never, doc, deps(vi.fn(async () => okResponse("Accepted"))))

    expect(res.ok).toBe(false)
    expect(res.reason).toBe("unparseable_response")
    expect(res.summary).toBeNull()
    const patches = db.updates.map((u) => u.patch)
    expect(patches.some((p) => "summary" in p)).toBe(false)
  })

  it("reports a non-2xx webhook response as webhook_error", async () => {
    const bad = { ok: false, status: 502, text: async () => "Bad Gateway" } as unknown as Response
    const res = await summarizeAndStoreDocument(
      new FakeSupabase({ summary_attempts: 1 }) as never,
      doc,
      deps(vi.fn(async () => bad))
    )
    expect(res.ok).toBe(false)
    expect(res.reason).toBe("webhook_error")
  })

  it("reports a thrown fetch as network_error", async () => {
    const res = await summarizeAndStoreDocument(
      new FakeSupabase({ summary_attempts: 1 }) as never,
      doc,
      deps(vi.fn(async () => { throw new Error("ECONNRESET") }))
    )
    expect(res.ok).toBe(false)
    expect(res.reason).toBe("network_error")
  })

  it("leaves the document pending when attempts remain", async () => {
    const db = new FakeSupabase({ summary_attempts: 1 })
    await summarizeAndStoreDocument(db as never, doc, deps(vi.fn(async () => okResponse("Accepted"))))
    expect(db.updates.at(-1)!.patch).toEqual({ summary_status: "pending" })
  })

  // The RC3 regression test: the assertion that a document can EVER leave 'pending'.
  // Before the claim RPC incremented summary_attempts, this was structurally impossible —
  // a totally broken webhook looked identical to "nobody ever clicked".
  it("marks the document failed once the attempt budget is spent", async () => {
    const db = new FakeSupabase({ summary_attempts: 3 })
    await summarizeAndStoreDocument(db as never, doc, deps(vi.fn(async () => okResponse("Accepted"))))
    expect(db.updates.at(-1)!.patch).toEqual({ summary_status: "failed" })
  })

  it("treats an unreadable attempts row as exhausted rather than retrying forever", async () => {
    const db = new FakeSupabase(null)
    await summarizeAndStoreDocument(db as never, doc, deps(vi.fn(async () => okResponse("Accepted"))))
    expect(db.updates.at(-1)!.patch).toEqual({ summary_status: "failed" })
  })

  // The claim RPC owns the increment. If the worker also wrote it, every run would consume
  // two attempts and the retry budget would be halved.
  it("never writes summary_attempts itself", async () => {
    const db = new FakeSupabase({ summary_attempts: 1 })
    await summarizeAndStoreDocument(db as never, doc, deps(vi.fn(async () => okResponse("Accepted"))))
    await summarizeAndStoreDocument(db as never, doc, deps(vi.fn(async () => okResponse(goodBody))))
    expect(db.updates.every((u) => !("summary_attempts" in u.patch))).toBe(true)
  })

  it("ignores a delimited response naming a different document", async () => {
    const other = `22222222-2222-4222-8222-222222222222${SUMMARY_DELIMITER}Summary of someone else.`
    const db = new FakeSupabase({ summary_attempts: 1 })
    const res = await summarizeAndStoreDocument(db as never, doc, deps(vi.fn(async () => okResponse(other))))

    expect(res.ok).toBe(false)
    expect(db.updates.every((u) => !("summary" in u.patch))).toBe(true)
  })
})
