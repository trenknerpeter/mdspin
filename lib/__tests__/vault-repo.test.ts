import { describe, it, expect, vi } from "vitest"
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
  select(...args: unknown[]) {
    this.calls.push({ method: "select", args })
    return this
  }
  single() {
    this.calls.push({ method: "single", args: [] })
    return this
  }
  then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
    return Promise.resolve(this.result).then(resolve, reject)
  }
}

class FakeClient {
  builders: FakeBuilder[] = []
  rpcCalls: { name: string; args: unknown }[] = []
  constructor(
    private resultsByTable: Record<string, unknown> = {},
    private rpcResults: Record<string, unknown> = {}
  ) {}
  from(table: string) {
    return {
      select: (_cols: string, _opts?: unknown) => {
        const b = new FakeBuilder(this.resultsByTable[table])
        this.builders.push(b)
        return b
      },
      insert: (row: unknown) => {
        const b = new FakeBuilder(this.resultsByTable[table])
        b.calls.push({ method: "insert", args: [row] })
        this.builders.push(b)
        return b
      },
      update: (patch: unknown) => {
        const b = new FakeBuilder(this.resultsByTable[table])
        b.calls.push({ method: "update", args: [patch] })
        this.builders.push(b)
        return b
      },
    }
  }
  rpc(name: string, args: unknown) {
    this.rpcCalls.push({ name, args })
    return Promise.resolve(this.rpcResults[name] ?? { data: [], error: null })
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

  it("returns an empty page, not a 500, when the offset overshoots the total (PGRST103)", async () => {
    const client = new FakeClient({
      conversions: {
        data: null,
        error: { code: "PGRST103", message: "Requested range not satisfiable" },
        count: 24,
      },
    })
    const repo = createVaultRepo(client as never, SCOPE)
    await expect(repo.listDocuments({ offset: 26, limit: 2 })).resolves.toEqual({
      data: [],
      page: { limit: 2, offset: 26, total: 24, hasMore: false, nextOffset: null },
    })
  })

  it("works identically under an 'rls' scope — the choke point does not depend on enforce mode", async () => {
    const client = new FakeClient({ conversions: { data: [], error: null, count: 0 } })
    const repo = createVaultRepo(client as never, { enforce: "rls", userId: "user-123" })
    await repo.listDocuments()
    const [builder] = client.builders
    expect(eqCalls(builder)).toContainEqual({ method: "eq", args: ["user_id", "user-123"] })
  })

  it("getDocument surfaces summary and summary_status through to the mapped VaultDocument", async () => {
    const client = new FakeClient({
      conversions: {
        data: {
          id: "doc-1", filename: "f.md", title: null, file_type: "markdown", word_count: 1,
          project_id: null, tags: [], source_type: "note", converted_at: "2026-08-01T00:00:00Z",
          updated_at: "2026-08-01T00:00:00Z", version: 1, summary: "A summary.", summary_status: "ready",
        },
        error: null,
      },
    })
    const repo = createVaultRepo(client as never, SCOPE)
    const doc = await repo.getDocument("doc-1")
    expect(doc?.summary).toBe("A summary.")
    expect(doc?.summaryStatus).toBe("ready")
  })

  it("listProjects surfaces instructions through to the mapped VaultProject", async () => {
    const client = new FakeClient({
      projects: {
        data: [{ id: "p1", name: "Strategy", color: null, created_at: "2026-08-01T00:00:00Z", instructions: "Focus on pricing." }],
        error: null,
      },
    })
    const repo = createVaultRepo(client as never, SCOPE)
    const projects = await repo.listProjects()
    expect(projects[0].instructions).toBe("Focus on pricing.")
  })
})

describe("getRelatedDocuments", () => {
  it("calls find_related_documents with an explicit p_user_id, never auth.uid()", async () => {
    const client = new FakeClient({}, {
      find_related_documents: {
        data: [
          {
            id: "doc-2", filename: "sibling.md", title: "Sibling", file_type: "markdown",
            word_count: 100, tags: ["a"], project_id: "proj-1",
            converted_at: "2026-08-01T00:00:00Z", rank: 0.2, strength: "medium",
          },
        ],
        error: null,
      },
    })
    const repo = createVaultRepo(client as never, SCOPE)
    const results = await repo.getRelatedDocuments("doc-1", 5)

    expect(client.rpcCalls).toContainEqual({
      name: "find_related_documents",
      args: { p_user_id: "user-123", p_source_id: "doc-1", p_max_results: 5 },
    })
    expect(results).toEqual([
      {
        id: "doc-2", filename: "sibling.md", title: "Sibling", fileType: "markdown",
        wordCount: 100, tags: ["a"], projectId: "proj-1",
        convertedAt: "2026-08-01T00:00:00Z", rank: 0.2, strength: "medium",
      },
    ])
  })

  it("defaults maxResults to 10", async () => {
    const client = new FakeClient({}, { find_related_documents: { data: [], error: null } })
    const repo = createVaultRepo(client as never, SCOPE)
    await repo.getRelatedDocuments("doc-1")
    expect(client.rpcCalls[0].args).toMatchObject({ p_max_results: 10 })
  })

  it("clamps an out-of-range maxResults instead of passing it through raw", async () => {
    const client = new FakeClient({}, { find_related_documents: { data: [], error: null } })
    const repo = createVaultRepo(client as never, SCOPE)
    await repo.getRelatedDocuments("doc-1", -1)
    expect(client.rpcCalls[0].args).toMatchObject({ p_max_results: 1 })

    await repo.getRelatedDocuments("doc-1", 999)
    expect(client.rpcCalls[1].args).toMatchObject({ p_max_results: 25 })
  })

  it("surfaces a Postgres error as a VaultError", async () => {
    const client = new FakeClient({}, {
      find_related_documents: { data: null, error: { message: "timeout" } },
    })
    const repo = createVaultRepo(client as never, SCOPE)
    await expect(repo.getRelatedDocuments("doc-1")).rejects.toThrow("timeout")
  })
})

describe("getStats", () => {
  it("calls vault_stats with p_user_id and maps the row", async () => {
    const client = new FakeClient({}, {
      vault_stats: {
        data: [{ document_count: 15, project_count: 5, top_tags: [{ tag: "assignment", count: 2 }] }],
        error: null,
      },
    })
    const repo = createVaultRepo(client as never, SCOPE)
    const stats = await repo.getStats()

    expect(client.rpcCalls).toContainEqual({ name: "vault_stats", args: { p_user_id: "user-123" } })
    expect(stats).toEqual({
      documentCount: 15,
      projectCount: 5,
      topTags: [{ tag: "assignment", count: 2 }],
    })
  })

  it("falls back to empty stats if the RPC returns no row", async () => {
    const client = new FakeClient({}, { vault_stats: { data: [], error: null } })
    const repo = createVaultRepo(client as never, SCOPE)
    expect(await repo.getStats()).toEqual({ documentCount: 0, projectCount: 0, topTags: [] })
  })

  it("surfaces a Postgres error as a VaultError", async () => {
    const client = new FakeClient({}, {
      vault_stats: { data: null, error: { message: "timeout" } },
    })
    const repo = createVaultRepo(client as never, SCOPE)
    await expect(repo.getStats()).rejects.toThrow("timeout")
  })
})

describe("searchDocuments", () => {
  it("calls vault_search_documents with clamped paging and maps rows + total from the page", async () => {
    const client = new FakeClient({}, {
      vault_search_documents: {
        data: [
          {
            id: "doc-3", filename: "gating.pdf", title: null, file_type: "pdf", word_count: 500,
            project_id: "proj-2", tags: ["data"], source_type: "upload",
            converted_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-02T00:00:00Z", version: 2,
            rank: 0.05, snippet: "...gating behavior...", total_count: 1,
          },
        ],
        error: null,
      },
    })
    const repo = createVaultRepo(client as never, SCOPE)
    const page = await repo.searchDocuments("gating", { limit: 5, offset: 0 })

    expect(client.rpcCalls).toContainEqual({
      name: "vault_search_documents",
      args: {
        p_user_id: "user-123", p_query: "gating",
        p_project_id: null, p_tags: null, p_limit: 5, p_offset: 0,
        p_query_embedding: null,
      },
    })
    expect(page.data).toEqual([
      {
        id: "doc-3", filename: "gating.pdf", title: null, fileType: "pdf", wordCount: 500,
        projectIds: ["proj-2"], tags: ["data"], sourceType: "upload",
        convertedAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-02T00:00:00Z", version: 2,
        markdown: null, summary: null, summaryStatus: "pending", rank: 0.05, snippet: "...gating behavior...",
      },
    ])
    expect(page.page).toEqual({ limit: 5, offset: 0, total: 1, hasMore: false, nextOffset: null })
  })

  it("passes projectId and tags through when given", async () => {
    const client = new FakeClient({}, { vault_search_documents: { data: [], error: null } })
    const repo = createVaultRepo(client as never, SCOPE)
    await repo.searchDocuments("x", { projectId: "proj-9", tags: ["a", "b"] })
    expect(client.rpcCalls[0].args).toMatchObject({ p_project_id: "proj-9", p_tags: ["a", "b"] })
  })

  it("normalizes an empty-array tags filter to null instead of an always-empty overlap", async () => {
    const client = new FakeClient({}, { vault_search_documents: { data: [], error: null } })
    const repo = createVaultRepo(client as never, SCOPE)
    await repo.searchDocuments("x", { tags: [] })
    expect(client.rpcCalls[0].args).toMatchObject({ p_tags: null })
  })

  it("normalizes an empty-string projectId to null instead of a 22P02 uuid cast error", async () => {
    const client = new FakeClient({}, { vault_search_documents: { data: [], error: null } })
    const repo = createVaultRepo(client as never, SCOPE)
    await repo.searchDocuments("x", { projectId: "" })
    expect(client.rpcCalls[0].args).toMatchObject({ p_project_id: null })
  })

  it("surfaces a Postgres error as a VaultError", async () => {
    const client = new FakeClient({}, {
      vault_search_documents: { data: null, error: { message: "timeout" } },
    })
    const repo = createVaultRepo(client as never, SCOPE)
    await expect(repo.searchDocuments("x")).rejects.toThrow("timeout")
  })

  it("forwards a real query embedding through to the RPC when embedQueryOrNull resolves one", async () => {
    vi.doMock("@/lib/vault/embeddings", () => ({ embedQueryOrNull: async () => [0.1, 0.2, 0.3] }))
    vi.resetModules()
    const { createVaultRepo: freshCreateVaultRepo } = await import("@/lib/vault/repo")

    const client = new FakeClient({}, { vault_search_documents: { data: [], error: null } })
    const repo = freshCreateVaultRepo(client as never, SCOPE)
    await repo.searchDocuments("gating")

    expect(client.rpcCalls[0].args).toMatchObject({ p_query_embedding: [0.1, 0.2, 0.3] })
    vi.doUnmock("@/lib/vault/embeddings")
  })
})

describe("updateDocument", () => {
  const RPC_ROW = {
    id: "doc-1", filename: "f.md", title: "New title", file_type: "markdown", word_count: 10,
    project_id: null, tags: ["scratch"], source_type: "note",
    converted_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-02T00:00:00Z", version: 2,
  }

  it("sends only the patched keys, with explicit p_user_id and the expected version", async () => {
    const client = new FakeClient({}, { vault_update_document: { data: [RPC_ROW], error: null } })
    const repo = createVaultRepo(client as never, SCOPE)
    const doc = await repo.updateDocument("doc-1", { title: "New title" }, { expectedVersion: 1 })

    expect(client.rpcCalls).toContainEqual({
      name: "vault_update_document",
      args: {
        p_user_id: "user-123", p_document_id: "doc-1", p_expected_version: 1,
        p_patch: { title: "New title" }, p_actor: "user", p_actor_key_id: null, p_reason: null,
        p_confirm_shrink: false,
      },
    })
    expect(doc.title).toBe("New title")
    expect(doc.version).toBe(2)
  })

  it("includes an explicit null when a caller clears a field, but omits untouched fields", async () => {
    const client = new FakeClient({}, { vault_update_document: { data: [RPC_ROW], error: null } })
    const repo = createVaultRepo(client as never, SCOPE)
    await repo.updateDocument("doc-1", { title: null }, { expectedVersion: 1 })
    expect(client.rpcCalls[0].args).toMatchObject({ p_patch: { title: null } })
  })

  it("passes actor, actorKeyId, and reason through when given", async () => {
    const client = new FakeClient({}, { vault_update_document: { data: [RPC_ROW], error: null } })
    const repo = createVaultRepo(client as never, SCOPE)
    await repo.updateDocument("doc-1", { tags: ["a"] }, {
      expectedVersion: 1, actor: "api", actorKeyId: "key-1", reason: "sync",
    })
    expect(client.rpcCalls[0].args).toMatchObject({
      p_actor: "api", p_actor_key_id: "key-1", p_reason: "sync",
    })
  })

  it("maps a 55000 error to VERSION_CONFLICT with the current version in the message", async () => {
    const client = new FakeClient({}, {
      vault_update_document: { data: null, error: { code: "55000", message: "VERSION_CONFLICT", details: "3" } },
    })
    const repo = createVaultRepo(client as never, SCOPE)
    await expect(repo.updateDocument("doc-1", { title: "x" }, { expectedVersion: 1 }))
      .rejects.toMatchObject({ code: "VERSION_CONFLICT", status: 409 })
  })

  it("maps a P0002 error to NOT_FOUND", async () => {
    const client = new FakeClient({}, {
      vault_update_document: { data: null, error: { code: "P0002", message: "NOT_FOUND" } },
    })
    const repo = createVaultRepo(client as never, SCOPE)
    await expect(repo.updateDocument("doc-1", { title: "x" }, { expectedVersion: 1 }))
      .rejects.toMatchObject({ code: "NOT_FOUND", status: 404 })
  })

  it("maps a 28000 error to AUTH_REQUIRED", async () => {
    const client = new FakeClient({}, {
      vault_update_document: { data: null, error: { code: "28000", message: "AUTH_REQUIRED" } },
    })
    const repo = createVaultRepo(client as never, SCOPE)
    await expect(repo.updateDocument("doc-1", { title: "x" }, { expectedVersion: 1 }))
      .rejects.toMatchObject({ code: "AUTH_REQUIRED", status: 401 })
  })

  it("maps a 22023 error to INVALID_REQUEST — a project_id the caller doesn't own", async () => {
    const client = new FakeClient({}, {
      vault_update_document: { data: null, error: { code: "22023", message: "INVALID_REQUEST" } },
    })
    const repo = createVaultRepo(client as never, SCOPE)
    await expect(repo.updateDocument("doc-1", { projectId: "proj-not-mine" }, { expectedVersion: 1 }))
      .rejects.toMatchObject({ code: "INVALID_REQUEST", status: 400 })
  })

  it("rejects an empty patch before ever calling the RPC", async () => {
    const client = new FakeClient({}, { vault_update_document: { data: [RPC_ROW], error: null } })
    const repo = createVaultRepo(client as never, SCOPE)
    await expect(repo.updateDocument("doc-1", {}, { expectedVersion: 1 }))
      .rejects.toMatchObject({ code: "INVALID_REQUEST", status: 400 })
    expect(client.rpcCalls.length).toBe(0)
  })
})

describe("listDocumentsByCursor", () => {
  it("first page (no cursor) omits the .or() filter and orders by updated_at desc, id desc", async () => {
    const client = new FakeClient({ conversions: { data: [], error: null } })
    const repo = createVaultRepo(client as never, SCOPE)
    await repo.listDocumentsByCursor({ limit: 5 })
    const [builder] = client.builders
    expect(builder.calls.filter((c) => c.method === "or")).toEqual([])
    expect(builder.calls.filter((c) => c.method === "order")).toEqual([
      { method: "order", args: ["updated_at", { ascending: false }] },
      { method: "order", args: ["id", { ascending: false }] },
    ])
  })

  it("builds the compound keyset .or() filter from a valid cursor", async () => {
    const client = new FakeClient({ conversions: { data: [], error: null } })
    const repo = createVaultRepo(client as never, SCOPE)
    await repo.listDocumentsByCursor({
      cursor: { updatedAt: "2026-08-01T00:00:00Z", id: "11111111-1111-1111-1111-111111111111" },
    })
    const [builder] = client.builders
    expect(builder.calls.filter((c) => c.method === "or")).toEqual([
      {
        method: "or",
        args: [
          "updated_at.lt.2026-08-01T00:00:00Z,and(updated_at.eq.2026-08-01T00:00:00Z,id.lt.11111111-1111-1111-1111-111111111111)",
        ],
      },
    ])
  })

  it("rejects a cursor with a malformed id before building any query", async () => {
    const client = new FakeClient({ conversions: { data: [], error: null } })
    const repo = createVaultRepo(client as never, SCOPE)
    await expect(
      repo.listDocumentsByCursor({
        cursor: { updatedAt: "2026-08-01T00:00:00Z", id: "'); DROP TABLE conversions;--" },
      })
    ).rejects.toThrow(/Invalid cursor/)
    expect(client.builders).toHaveLength(0)
  })

  it("rejects a cursor with a malformed timestamp before building any query", async () => {
    const client = new FakeClient({ conversions: { data: [], error: null } })
    const repo = createVaultRepo(client as never, SCOPE)
    await expect(
      repo.listDocumentsByCursor({
        cursor: { updatedAt: "not-a-date,or(1.eq.1)", id: "11111111-1111-1111-1111-111111111111" },
      })
    ).rejects.toThrow(/Invalid cursor/)
    expect(client.builders).toHaveLength(0)
  })

  it("returns nextCursor from the last row when a full page comes back", async () => {
    const fullRow = (id: string, updatedAt: string) => ({
      id, filename: "f.md", title: null, file_type: "markdown", word_count: 1, project_id: null,
      tags: [], source_type: "note", converted_at: updatedAt, updated_at: updatedAt, version: 1,
    })
    const client = new FakeClient({
      conversions: {
        data: [fullRow("d1", "2026-08-02T00:00:00Z"), fullRow("d2", "2026-08-01T00:00:00Z")],
        error: null,
      },
    })
    const repo = createVaultRepo(client as never, SCOPE)
    const page = await repo.listDocumentsByCursor({ limit: 2 })
    expect(page.nextCursor).toEqual({ updatedAt: "2026-08-01T00:00:00Z", id: "d2" })
  })

  it("returns nextCursor: null when fewer rows than the limit come back", async () => {
    const client = new FakeClient({
      conversions: {
        data: [{
          id: "d1", filename: "f.md", title: null, file_type: "markdown", word_count: 1,
          project_id: null, tags: [], source_type: "note", converted_at: "x",
          updated_at: "2026-08-01T00:00:00Z", version: 1,
        }],
        error: null,
      },
    })
    const repo = createVaultRepo(client as never, SCOPE)
    const page = await repo.listDocumentsByCursor({ limit: 5 })
    expect(page.nextCursor).toBeNull()
  })

  it("scopes by user_id and project_id/tags exactly like listDocuments", async () => {
    const client = new FakeClient({ conversions: { data: [], error: null } })
    const repo = createVaultRepo(client as never, SCOPE)
    await repo.listDocumentsByCursor({ projectId: "proj-1", tags: ["pm"] })
    const [builder] = client.builders
    expect(eqCalls(builder)).toContainEqual({ method: "eq", args: ["user_id", "user-123"] })
    expect(eqCalls(builder)).toContainEqual({ method: "eq", args: ["project_id", "proj-1"] })
    expect(builder.calls).toContainEqual({ method: "overlaps", args: ["tags", ["pm"]] })
  })
})

describe("createDocument", () => {
  it("inserts with user_id from scope, source_type mcp, and derives a filename from the title", async () => {
    const client = new FakeClient({
      conversions: {
        data: { id: "d1", filename: "my-note.md", title: "My Note", file_type: "md", word_count: 2, project_id: null, tags: [], source_type: "mcp", converted_at: "t", updated_at: "t", version: 1, markdown_text: "hi there" },
        error: null,
      },
    })
    const repo = createVaultRepo(client as never, SCOPE)
    const doc = await repo.createDocument({ title: "My Note", markdown: "hi there" })
    expect(doc.title).toBe("My Note")
    expect(doc.sourceType).toBe("mcp")
    expect(client.builders[0].calls[0]).toEqual({
      method: "insert",
      args: [{
        user_id: "user-123",
        filename: "my-note.md",
        file_type: "md",
        title: "My Note",
        markdown_text: "hi there",
        word_count: 2,
        tags: [],
        project_id: null,
        in_vault: true,
        source_type: "mcp",
      }],
    })
  })

  it("rejects a project_id the user doesn't own", async () => {
    const client = new FakeClient({ projects: { data: null, error: null } })
    const repo = createVaultRepo(client as never, SCOPE)
    await expect(repo.createDocument({ markdown: "x", projectId: "not-mine" })).rejects.toMatchObject({ code: "INVALID_REQUEST" })
  })
})

describe("appendToDocument", () => {
  it("calls vault_append_to_document with actor defaulted to mcp", async () => {
    const client = new FakeClient({}, {
      vault_append_to_document: { data: [{ id: "d1", filename: "f.md", title: null, file_type: "md", word_count: 3, project_id: null, tags: [], source_type: "note", converted_at: "t", updated_at: "t", version: 2 }], error: null },
    })
    const repo = createVaultRepo(client as never, SCOPE)
    const doc = await repo.appendToDocument("d1", "more text")
    expect(doc.version).toBe(2)
    expect(client.rpcCalls[0]).toEqual({ name: "vault_append_to_document", args: { p_user_id: "user-123", p_document_id: "d1", p_addition: "more text", p_actor: "mcp", p_actor_key_id: null, p_reason: null } })
  })

  it("rejects an empty addition before calling the RPC", async () => {
    const client = new FakeClient()
    const repo = createVaultRepo(client as never, SCOPE)
    await expect(repo.appendToDocument("d1", "   ")).rejects.toMatchObject({ code: "INVALID_REQUEST" })
    expect(client.rpcCalls).toHaveLength(0)
  })

  it("maps NOT_FOUND", async () => {
    const client = new FakeClient({}, { vault_append_to_document: { data: null, error: { code: "P0002", message: "x" } } })
    const repo = createVaultRepo(client as never, SCOPE)
    await expect(repo.appendToDocument("d1", "x")).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})

describe("organizeDocument", () => {
  it("calls vault_organize_document with add/remove tags", async () => {
    const client = new FakeClient({}, {
      vault_organize_document: { data: [{ id: "d1", filename: "f.md", title: null, file_type: "md", word_count: 1, project_id: null, tags: ["a"], source_type: "note", converted_at: "t", updated_at: "t", version: 3 }], error: null },
    })
    const repo = createVaultRepo(client as never, SCOPE)
    const doc = await repo.organizeDocument("d1", { addTags: ["a"], removeTags: ["b"] })
    expect(doc.tags).toEqual(["a"])
    expect(client.rpcCalls[0].args).toMatchObject({ p_add_tags: ["a"], p_remove_tags: ["b"], p_actor: "mcp" })
  })

  it("rejects when neither add nor remove tags are given", async () => {
    const client = new FakeClient()
    const repo = createVaultRepo(client as never, SCOPE)
    await expect(repo.organizeDocument("d1", {})).rejects.toMatchObject({ code: "INVALID_REQUEST" })
  })
})

describe("removeFromVault", () => {
  it("updates in_vault to false, scoped to user_id", async () => {
    const client = new FakeClient({ conversions: { data: { id: "d1" }, error: null } })
    const repo = createVaultRepo(client as never, SCOPE)
    await repo.removeFromVault("d1")
    const b = client.builders[0]
    expect(b.calls[0]).toEqual({ method: "update", args: [{ in_vault: false }] })
    expect(eqCalls(b).map((c) => c.args)).toContainEqual(["user_id", "user-123"])
  })

  it("throws NOT_FOUND when no row matches", async () => {
    const client = new FakeClient({ conversions: { data: null, error: null } })
    const repo = createVaultRepo(client as never, SCOPE)
    await expect(repo.removeFromVault("nope")).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})

describe("updateDocument confirmShrink wiring", () => {
  it("passes p_confirm_shrink through, defaulting to false", async () => {
    const client = new FakeClient({}, {
      vault_update_document: { data: [{ id: "d1", filename: "f.md", title: null, file_type: "md", word_count: 1, project_id: null, tags: [], source_type: "note", converted_at: "t", updated_at: "t", version: 2 }], error: null },
    })
    const repo = createVaultRepo(client as never, SCOPE)
    await repo.updateDocument("d1", { markdown: "x" }, { expectedVersion: 1, confirmShrink: true })
    expect(client.rpcCalls[0].args).toMatchObject({ p_confirm_shrink: true })
  })

  it("maps IMMUTABLE_SOURCE and SUSPICIOUS_SHRINK", async () => {
    const client = new FakeClient({}, { vault_update_document: { data: null, error: { code: "0A000", message: "x" } } })
    const repo = createVaultRepo(client as never, SCOPE)
    await expect(repo.updateDocument("d1", { markdown: "x" }, { expectedVersion: 1 })).rejects.toMatchObject({ code: "IMMUTABLE_SOURCE" })

    const client2 = new FakeClient({}, { vault_update_document: { data: null, error: { code: "22001", message: "x", details: '{"previous_length":5000,"new_length":100}' } } })
    const repo2 = createVaultRepo(client2 as never, SCOPE)
    await expect(repo2.updateDocument("d1", { markdown: "x" }, { expectedVersion: 1 })).rejects.toMatchObject({ code: "SUSPICIOUS_SHRINK" })
  })
})
