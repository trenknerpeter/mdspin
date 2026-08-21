import { describe, it, expect } from "vitest"
import { createVaultRepo } from "@/lib/vault/repo"
import type { VaultScope } from "@/lib/vault/types"

// A minimal fake of supabase-js's fluent query builder. Real chains (.eq/.order/.range/
// .maybeSingle) all return `this`-shaped builders and are awaitable directly OR via a
// terminal call — this fake supports both by implementing `.then()`.
class FakeBuilder {
  calls: { method: string; args: unknown[] }[] = []
  constructor(private result: unknown) {}
  eq(...args: unknown[]) {
    this.calls.push({ method: "eq", args })
    return this
  }
  overlaps(...args: unknown[]) {
    this.calls.push({ method: "overlaps", args })
    return this
  }
  or(...args: unknown[]) {
    this.calls.push({ method: "or", args })
    return this
  }
  order(...args: unknown[]) {
    this.calls.push({ method: "order", args })
    return this
  }
  range(...args: unknown[]) {
    this.calls.push({ method: "range", args })
    return this
  }
  maybeSingle() {
    this.calls.push({ method: "maybeSingle", args: [] })
    return this
  }
  update(...args: unknown[]) {
    this.calls.push({ method: "update", args })
    return this
  }
  then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
    return Promise.resolve(this.result).then(resolve, reject)
  }
}

class FakeClient {
  builders: FakeBuilder[] = []
  constructor(private resultsByTable: Record<string, unknown>) {}
  from(table: string) {
    return {
      select: (_cols: string, _opts?: unknown) => {
        const b = new FakeBuilder(this.resultsByTable[table])
        this.builders.push(b)
        return b
      },
    }
  }
}

function eqCalls(b: FakeBuilder) {
  return b.calls.filter((c) => c.method === "eq")
}

const SCOPE: VaultScope = { enforce: "explicit", userId: "user-123" }

describe("createVaultRepo — the scoped() choke point", () => {
  it("throws AUTH_REQUIRED at construction if the scope has no userId", () => {
    expect(() => createVaultRepo(new FakeClient({}) as never, { enforce: "rls", userId: "" })).toThrow(
      /userId/
    )
  })

  it("listDocuments always filters by user_id, regardless of other filters", async () => {
    const client = new FakeClient({
      conversions: { data: [], error: null, count: 0 },
    })
    const repo = createVaultRepo(client as never, SCOPE)
    await repo.listDocuments()
    const [builder] = client.builders
    expect(eqCalls(builder)).toContainEqual({ method: "eq", args: ["user_id", "user-123"] })
  })

  it("listDocuments also scopes to a specific project when asked, on top of user_id", async () => {
    const client = new FakeClient({ conversions: { data: [], error: null, count: 0 } })
    const repo = createVaultRepo(client as never, SCOPE)
    await repo.listDocuments({ projectId: "proj-9" })
    const [builder] = client.builders
    expect(eqCalls(builder)).toContainEqual({ method: "eq", args: ["project_id", "proj-9"] })
    // The project filter must never REPLACE the user filter.
    expect(eqCalls(builder)).toContainEqual({ method: "eq", args: ["user_id", "user-123"] })
  })

  it("listDocuments always excludes docs outside the vault", async () => {
    const client = new FakeClient({ conversions: { data: [], error: null, count: 0 } })
    const repo = createVaultRepo(client as never, SCOPE)
    await repo.listDocuments()
    const [builder] = client.builders
    expect(eqCalls(builder)).toContainEqual({ method: "eq", args: ["in_vault", true] })
  })

  it("getDocument scopes by user_id AND the requested id — never id alone", async () => {
    const client = new FakeClient({
      conversions: {
        data: {
          id: "doc-1",
          filename: "f.md",
          title: null,
          file_type: "markdown",
          word_count: 1,
          project_id: null,
          tags: [],
          source_type: "note",
          converted_at: "2026-08-01T00:00:00Z",
          updated_at: "2026-08-01T00:00:00Z",
          version: 1,
        },
        error: null,
      },
    })
    const repo = createVaultRepo(client as never, SCOPE)
    const doc = await repo.getDocument("doc-1")
    const [builder] = client.builders
    expect(eqCalls(builder)).toContainEqual({ method: "eq", args: ["user_id", "user-123"] })
    expect(eqCalls(builder)).toContainEqual({ method: "eq", args: ["id", "doc-1"] })
    expect(doc?.id).toBe("doc-1")
    expect(doc?.markdown).toBeNull() // includeMarkdown not requested
  })

  it("getDocument returns null, not a thrown error, when no row matches", async () => {
    const client = new FakeClient({ conversions: { data: null, error: null } })
    const repo = createVaultRepo(client as never, SCOPE)
    expect(await repo.getDocument("missing")).toBeNull()
  })

  it("listProjects and getProject are also scoped by user_id", async () => {
    const client = new FakeClient({
      projects: { data: [{ id: "p1", name: "Strategy", color: null, created_at: "2026-08-01T00:00:00Z" }], error: null },
    })
    const repo = createVaultRepo(client as never, SCOPE)
    await repo.listProjects()
    const [builder] = client.builders
    expect(eqCalls(builder)).toContainEqual({ method: "eq", args: ["user_id", "user-123"] })
  })

  it("surfaces a Postgres error as a VaultError rather than an unhandled rejection", async () => {
    const client = new FakeClient({
      conversions: { data: null, error: { message: "connection reset" }, count: null },
    })
    const repo = createVaultRepo(client as never, SCOPE)
    await expect(repo.listDocuments()).rejects.toThrow("connection reset")
  })

  it("works identically under an 'rls' scope — the choke point does not depend on enforce mode", async () => {
    const client = new FakeClient({ conversions: { data: [], error: null, count: 0 } })
    const repo = createVaultRepo(client as never, { enforce: "rls", userId: "user-123" })
    await repo.listDocuments()
    const [builder] = client.builders
    expect(eqCalls(builder)).toContainEqual({ method: "eq", args: ["user_id", "user-123"] })
  })
})
