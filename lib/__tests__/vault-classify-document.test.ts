import { describe, it, expect, vi } from "vitest"
import { classifyAndStoreDocument, type ClassifiableDoc } from "@/lib/vault/classify-document"
import { FILING_DELIMITER, type FilingCandidateProject } from "@/lib/vault/filing"

// Same FakeChain/FakeSupabase shape as vault-summarize-document.test.ts, extended with a
// per-table update/select/insert log so the "projects" insert (new-project creation) and
// the "conversions" update can be asserted independently.
class FakeChain {
  constructor(
    public record: Record<string, unknown>,
    private result: unknown
  ) {}
  eq(...args: unknown[]) {
    this.record.eq = args
    return this
  }
  maybeSingle() {
    return this
  }
  single() {
    return this
  }
  select(cols: string) {
    this.record.select = cols
    return this
  }
  then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
    return Promise.resolve(this.result).then(resolve, reject)
  }
}

class FakeSupabase {
  conversionUpdates: Record<string, unknown>[] = []
  projectInserts: Record<string, unknown>[] = []
  constructor(
    private attemptsRow: unknown = { filing_attempts: 0 },
    private createdProject: unknown = { id: "new-project-id" }
  ) {}
  from(table: string) {
    if (table === "conversions") {
      return {
        update: (patch: Record<string, unknown>) => {
          const rec = { patch }
          this.conversionUpdates.push(rec)
          return new FakeChain(rec, { error: null })
        },
        select: (cols: string) => {
          const rec = { select: cols }
          return new FakeChain(rec, { data: this.attemptsRow })
        },
      }
    }
    if (table === "projects") {
      return {
        insert: (row: Record<string, unknown>) => {
          this.projectInserts.push(row)
          return new FakeChain({}, { data: this.createdProject, error: null })
        },
      }
    }
    throw new Error(`unexpected table ${table}`)
  }
}

const candidates: FilingCandidateProject[] = [
  { id: "p1", name: "Acme Handbook" },
  { id: "p2", name: "Client Beta" },
]

const doc: ClassifiableDoc = {
  id: "d1",
  user_id: "u1",
  title: "Notes",
  filename: "notes.md",
  markdown_text: "Some content about Acme's Q3 handbook revision.",
  external_id: "docs/notes.md",
  source_connection_id: "conn1",
}

const okResponse = (body: string) => ({ ok: true, status: 200, text: async () => body }) as unknown as Response
const decisionBody = (id: string, json: unknown) => `${id}${FILING_DELIMITER}${JSON.stringify(json)}`

const deps = (fetchImpl: unknown, repoName: string | null = null) => ({
  webhookUrl: "https://hook.example.com/filing",
  webhookSecret: "s3cret",
  fetchImpl: fetchImpl as typeof fetch,
  repoName,
  now: () => "2026-09-23T00:00:00.000Z",
})

describe("classifyAndStoreDocument", () => {
  it("files by path match without ever calling the webhook", async () => {
    const fetchImpl = vi.fn()
    const db = new FakeSupabase()
    const res = await classifyAndStoreDocument(db as never, doc, candidates, deps(fetchImpl, "Acme Handbook"))

    expect(res.outcome).toBe("filed")
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(db.conversionUpdates[0].patch).toMatchObject({ project_id: "p1", filing_status: "filed" })
  })

  it("files by a high-confidence content match, resolving the model's name to a candidate id", async () => {
    const fetchImpl = vi.fn(async () => okResponse(decisionBody("d1", { decision: "match", name: "Client Beta", confidence: 0.9 })))
    const db = new FakeSupabase()
    const res = await classifyAndStoreDocument(db as never, doc, candidates, deps(fetchImpl))

    expect(res.outcome).toBe("filed")
    expect(db.conversionUpdates[0].patch).toMatchObject({ project_id: "p2", filing_status: "filed" })
  })

  it("treats a match naming a project we don't recognise as a failure, not a guess", async () => {
    const fetchImpl = vi.fn(async () => okResponse(decisionBody("d1", { decision: "match", name: "Not A Real Project", confidence: 0.9 })))
    const db = new FakeSupabase()
    const res = await classifyAndStoreDocument(db as never, doc, candidates, deps(fetchImpl))

    expect(res.ok).toBe(false)
    expect(res.reason).toBe("unparseable_response")
  })

  it("resolves a 'new' decision that actually names an existing project into a match, rather than creating a duplicate", async () => {
    const fetchImpl = vi.fn(async () => okResponse(decisionBody("d1", { decision: "new", name: "client beta", confidence: 0.95 })))
    const db = new FakeSupabase()
    const res = await classifyAndStoreDocument(db as never, doc, candidates, deps(fetchImpl))

    expect(res.outcome).toBe("filed")
    expect(db.projectInserts).toHaveLength(0)
    expect(db.conversionUpdates[0].patch).toMatchObject({ project_id: "p2" })
  })

  it("creates a new project on a high-confidence 'new topic' decision", async () => {
    const fetchImpl = vi.fn(async () =>
      okResponse(decisionBody("d1", { decision: "new", name: "Client Gamma", confidence: 0.95 }))
    )
    const db = new FakeSupabase()
    const res = await classifyAndStoreDocument(db as never, doc, candidates, deps(fetchImpl))

    expect(res.outcome).toBe("filed")
    expect(res.createdProjectId).toBe("new-project-id")
    expect(db.projectInserts[0]).toMatchObject({ user_id: "u1", name: "Client Gamma", auto_created: true })
    expect(db.conversionUpdates[0].patch).toMatchObject({ project_id: "new-project-id" })
  })

  it("flags a below-threshold match with the guess, rather than filing it", async () => {
    const fetchImpl = vi.fn(async () => okResponse(decisionBody("d1", { decision: "match", name: "Client Beta", confidence: 0.4 })))
    const db = new FakeSupabase()
    const res = await classifyAndStoreDocument(db as never, doc, candidates, deps(fetchImpl))

    expect(res.outcome).toBe("flagged")
    expect(res.ok).toBe(true)
    const patch = db.conversionUpdates[0].patch as Record<string, unknown>
    expect(patch.filing_status).toBe("flagged")
    expect(patch.filing_suggested_project_id).toBe("p2")
    expect(patch.filing_note).toContain("Client Beta")
    expect(patch.project_id).toBeUndefined()
  })

  it("flags a 'none' decision with no suggested project", async () => {
    const fetchImpl = vi.fn(async () => okResponse(decisionBody("d1", { decision: "none", confidence: 0.3 })))
    const db = new FakeSupabase()
    const res = await classifyAndStoreDocument(db as never, doc, candidates, deps(fetchImpl))

    expect(res.outcome).toBe("flagged")
    const patch = db.conversionUpdates[0].patch as Record<string, unknown>
    expect(patch.filing_suggested_project_id).toBeNull()
  })

  // Mirrors summarize-document.test.ts's identical regression guard: a blocked Make filter
  // answers HTTP 200 with the literal body "Accepted", which must never be mistaken for a
  // real decision and must never file a document.
  it("NEVER files a document off Make's blocked-request acknowledgement", async () => {
    const db = new FakeSupabase({ filing_attempts: 1 })
    const res = await classifyAndStoreDocument(db as never, doc, candidates, deps(vi.fn(async () => okResponse("Accepted"))))

    expect(res.ok).toBe(false)
    expect(res.reason).toBe("unparseable_response")
    expect(db.conversionUpdates[0].patch).toEqual({ filing_status: "pending", filing_note: null })
  })

  it("gives up after the attempt budget is spent", async () => {
    const db = new FakeSupabase({ filing_attempts: 3 })
    await classifyAndStoreDocument(db as never, doc, candidates, deps(vi.fn(async () => okResponse("Accepted"))))
    expect(db.conversionUpdates[0].patch).toMatchObject({ filing_status: "failed" })
  })

  it("reports a non-2xx webhook response as webhook_error", async () => {
    const bad = { ok: false, status: 502, text: async () => "Bad Gateway" } as unknown as Response
    const db = new FakeSupabase({ filing_attempts: 1 })
    const res = await classifyAndStoreDocument(db as never, doc, candidates, deps(vi.fn(async () => bad)))
    expect(res.ok).toBe(false)
    expect(res.reason).toBe("webhook_error")
  })

  it("never writes filing_attempts itself — the claim RPC owns the increment", async () => {
    const db = new FakeSupabase({ filing_attempts: 1 })
    await classifyAndStoreDocument(db as never, doc, candidates, deps(vi.fn(async () => okResponse("Accepted"))))
    expect(db.conversionUpdates.every((u) => !("filing_attempts" in (u.patch as object)))).toBe(true)
  })
})
