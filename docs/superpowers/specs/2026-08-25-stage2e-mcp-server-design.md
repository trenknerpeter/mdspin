# Stage 2e — Vault MCP Server (read-only) — Implementation Design

**Date:** 2026-08-25
**Status:** Draft design, pending review
**Builds on:** Stage 2b (`lib/vault/auth.ts` — `authenticateRequest()`), Stage 2c (dual-auth RPCs), Stage 2d (`lib/vault/repo.ts`, `lib/vault/rest.ts` — REST is live at `/api/v1/vault/*`).
**Strategy parent:** [MDSpin Knowledge Vault → Cloud Knowledge Hub](/Users/p.trenkner/.claude/plans/MDSpin%20strategy.md), Stage 2e.

## What changed since the strategy doc was written

The strategy doc's Stage 2e section is detailed but was written before Stage 2d landed and before today's package-registry check. Three things it states are now stale or need a decision it didn't anticipate:

1. **`zod` is already a dependency** (`^3.24.1`, resolving to `3.25.76`) — pulled in for `@hookform/resolvers`, but **nothing in the repo imports it directly** (`grep` confirms zero hits, and `zodResolver`/`@hookform/resolvers` itself is also unused). The doc's claim "zod is not imported anywhere" is still effectively true and its "zero-risk bump" conclusion holds — verified today, not assumed.
2. **Live npm registry check today** confirms the doc's stack precisely: `mcp-handler`'s peer dependency is `@modelcontextprotocol/server: ^2.0.0`, which itself depends on `zod: ^4.2.0`. Latest `mcp-handler` is now **2.1.1** (the doc said 2.1.0) — pin **2.1.1**, the current exact latest, not the now-stale patch the doc named.
3. **`withMcpAuth` is exported under an `experimental_` alias** (`export { withMcpAuth, withMcpAuth as experimental_withMcpAuth }`) in the actual 2.1.1 package — the doc doesn't mention this. Both names work; use the plain `withMcpAuth` import, and note in code that the alias signals the API isn't fully stabilized upstream yet.

I inspected the actual `.d.ts` of `mcp-handler@2.1.1` and `@modelcontextprotocol/server@2.0.0` (via `npm pack`, not from memory) to confirm every signature this design depends on. Details below, at the point each one matters.

## Scope decision: what ships in 2e vs. what's deferred

The strategy doc's Stage 2e tool table lists 7 read tools and 2 prompts. Building against the *actual* current `lib/vault/repo.ts` (Stage 2d, already shipped) surfaces two tools that need a small repo-layer addition first, and one prompt that cannot work at all yet:

| Item | Verdict | Why |
|---|---|---|
| `vault_overview`, `search_vault`, `list_projects`, `get_project`, `get_related_documents` | **Ship as speced** | Direct composition of existing `repo.ts` methods, no gaps. |
| `get_document` | **Ship, with one repo addition** | `content: "summary"` needs the `summary` column, which `LIST_COLUMNS`/`VaultDocument` don't currently select (Stage 1 wrote `conversions.summary`; Stage 2's repo layer never surfaced it — a real, previously-unnoticed gap, not new scope creep). `content: "outline"` needs no new column — `extractHeadings()` (`lib/vault/title.ts`, existing) works off markdown already fetchable via `includeMarkdown`. |
| `list_documents` | **Ship, with one repo addition** | `repo.ts:75-77`'s own comment (written during Stage 2d) already flags this: *"list_documents over MCP needs a keyset cursor on (updated_at, id)... Add a cursor-based sibling method rather than changing this one."* This design does exactly that — see below. |
| `research_project` prompt | **Ship as speced** | Only reads `get_project` + `search_vault` + `get_document`, all present. |
| `capture_note` prompt | **Deferred to Stage 4** | Its entire behavior is "search for an existing doc first; append if found; only create if nothing matches" — `append_to_document` and `create_document` are Stage 4 tools that don't exist yet. Shipping this prompt now would reference tools the server hasn't registered; it's not a scope trim, it's a plan inconsistency the strategy doc didn't catch (Stage 4 lists these tools; Stage 2e's tool table never did, but included the prompt that needs them anyway). |
| `update_document`/`append_to_document`/`create_document`/`organize_document` | **Deferred to Stage 4**, as the strategy doc already says — confirmed still correct; `lib/vault/types.ts`'s `RevisionActor` already includes `"mcp"`, so the write path's plumbing is future-ready but not being built now. |

## Two small, justified additions to `lib/vault/repo.ts` (shared layer, not MCP-only)

Both are read-only, additive, and match the file's existing conventions exactly — see Stage 2d's own precedent (`keyId` threading) for "small justified additions to the shared layer are in scope when a task genuinely needs them."

### 1. Expose `summary`/`summary_status` on `VaultDocument`

- `lib/vault/types.ts`: add `summary: string | null` and `summaryStatus: string` to `VaultDocument`.
- `lib/vault/mappers.ts`: `toVaultDocument` reads `row.summary` / `row.summary_status` the same way it already reads every other column (no new logic, just two more fields).
- `lib/vault/repo.ts`: add `summary, summary_status` to `LIST_COLUMNS`.
- **No REST contract change.** `lib/vault/rest.ts`'s `documentToJson` explicitly lists fields rather than spreading — it will not emit `summary` unless told to, so `GET /api/v1/vault/documents*` stays byte-identical. (A future REST task can decide whether to expose it; out of scope here.)
- Existing repo tests (`vault-repo.test.ts`, `vault-mappers.test.ts`) need their fixture rows extended with `summary`/`summary_status` fields — mechanical, not a design decision.

### 2. A keyset-cursor sibling to `listDocuments`, for `list_documents` only

New method on `VaultRepo`:

```ts
listDocumentsByCursor(filter?: {
  projectId?: string
  tags?: string[]
  limit?: number
  cursor?: { updatedAt: string; id: string }
}): Promise<{ data: VaultDocument[]; nextCursor: { updatedAt: string; id: string } | null }>
```

Ordering is `updated_at desc, id desc` (a tiebreaker on `id` is required — `updated_at` alone is not unique, and without a tiebreaker two docs saved in the same millisecond can be skipped or repeated across pages, which is the exact "agent silently skips/duplicates rows" failure this method exists to prevent).

The compound predicate for "strictly after this cursor" is `(updated_at, id) < (cursor.updatedAt, cursor.id)` in that sort order. Supabase-js's fluent builder has no native tuple-comparison method, so this is built via `.or()`, the same escape hatch `listDocuments` already uses for its ILIKE search:

```ts
query.or(`updated_at.lt.${cursor.updatedAt},and(updated_at.eq.${cursor.updatedAt},id.lt.${cursor.id})`)
```

`nextCursor` is `{ updatedAt: last.updatedAt, id: last.id }` from the last row of a full page, or `null` when the page came back shorter than `limit` (no more rows). No `total`/`hasMore` — a keyset page genuinely doesn't know the total without a separate count query, and the whole point of switching to keyset was to avoid the offset-pagination failure mode, not to recreate offset's page-info shape on top of it.

Covering unit test (`vault-repo.test.ts`, same `FakeBuilder` pattern as the rest of the file): assert the `.or()` filter string is built correctly from a given cursor, and that omitting `cursor` produces a query with no `.or()` call at all (first page).

## Auth: reuse `getVaultForRequest` unchanged — zero new auth logic

`mcp-handler`'s `withMcpAuth(handler, verifyToken, opts)` calls `verifyToken(req: Request, bearerToken?: string) => AuthInfo | undefined | Promise<...>` (confirmed from the actual `.d.ts`, not the strategy doc's paraphrase — it matches). The `req` it hands you is a standard `Request`, whose `.headers` is a `Headers` object with `.get()` — this **already satisfies** `lib/vault/server.ts`'s `AuthenticatableRequest` interface (`{ headers: { get(name): string | null } }`) with zero adapter code.

So `lib/mcp/auth.ts` is almost embarrassingly small:

```ts
import { getVaultForRequest } from "@/lib/vault/server"
import type { AuthInfo } from "@modelcontextprotocol/server"

export async function verifyToken(req: Request): Promise<AuthInfo | undefined> {
  try {
    const { scope, keyId } = await getVaultForRequest(req)
    return { token: "", clientId: scope.userId, scopes: ["vault:read"], extra: { keyId } }
  } catch {
    return undefined
  }
}
```

Notes on the `AuthInfo` fields (from the real interface — `token`, `clientId`, `scopes` are all **required**, not optional, which the strategy doc doesn't mention):
- `token` is set to `""` — MCP's spec wants the raw bearer token here for resource-server introspection scenarios we don't have; nothing downstream reads it, and putting the real API key back into a context object that gets passed around is an unnecessary place for a secret to sit in memory.
- `clientId` carries `scope.userId` — the one thing everything downstream (`resolveUserId`) actually needs.
- `scopes: ["vault:read"]` is a fixed value today (no granular read/write split exists yet); Stage 4 can add `"vault:write"` and use `withMcpAuth`'s `requiredScopes` per write-tool-group without touching this function.
- `keyId` rides in `extra` (an `AuthInfo` field the interface provides exactly for this) so a future write path can attribute an MCP write to the specific API key, exactly like Stage 2d's REST `PATCH` already does.

This means `authenticateRequest()`'s cookie fallback path is technically still reachable (a request with no `Authorization` header falls through to a Supabase session cookie) — harmless in practice since every real MCP client sends a Bearer token, and not worth special-casing to explicitly reject, since doing so would duplicate logic `authenticateRequest` already owns.

`withMcpAuth`'s `required: true` (its own gate, not this function's job) is what turns a returned `undefined` into the correct 401 response — this design doesn't hand-roll that.

## `resolveUserId` — the one place `userId` is read

Per the strategy doc's write-safety rule (already true for reads too — no tool's Zod schema may ever contain a `user_id` parameter):

```ts
// lib/mcp/context.ts
export function resolveUserId(ctx: ServerContext): string {
  const userId = ctx.http?.authInfo?.clientId
  if (!userId) throw new Error("resolveUserId called without a validated AuthInfo — withMcpAuth misconfigured?")
  return userId
}
```

Every tool handler's first line is `const userId = resolveUserId(ctx)`, then `createVaultRepo(adminClient, { enforce: "explicit", userId })` — the same service-role-plus-explicit-userId pattern Stage 2b already established for the REST layer, reused verbatim.

## Tool output shape: a new, separate module — not a re-export of `lib/vault/rest.ts`

REST's `documentToJson` etc. exist for a TypeScript client that wants stable, discoverable field names and is fine with a `markdown_text: null` key sitting in the payload it didn't ask for. An MCP tool's output goes straight into an LLM's context window, where **every key costs tokens** — this is explicitly called out in the strategy doc for `get_document` ("this is where token economy is won"), and it applies to all seven tools, not just that one.

So `lib/mcp/format.ts` is its own compact JSON module, reading the same `lib/vault/*` domain types but shaping output differently: omit null/empty fields rather than including them, never include a `markdown_text` key at all unless content was actually requested, and keep field names terse. It does **not** import from `lib/vault/rest.ts`; the two modules share only their input types (`VaultDocument`, `VaultProject`, ...), not their output shape. Every tool result is returned as a single `CallToolResult` content block: `{ content: [{ type: "text", text: JSON.stringify(payload) }] }` — plain JSON-as-text is the most broadly compatible shape across MCP clients today, and MDSpin's own REST layer already proved the JSON shape people want to consume; structured `outputSchema` validation (which `RegisteredTool` supports) is a nice-to-have this design doesn't need for a read-only server with human-legible payloads.

## Tools (final list for Stage 2e)

All input schemas are `zod` v4 objects (required now that `@modelcontextprotocol/server` needs Standard-Schema-compatible schemas, which zod v4 provides natively — this is the actual mechanical reason the strategy doc gives for the bump, confirmed against the real package: zod v3 objects don't satisfy `StandardSchemaWithJSON` the way v4's do).

| Tool | Args (zod) | Repo calls | Notes |
|---|---|---|---|
| `vault_overview` | *(none — `registerTool` with no `inputSchema` gives handlers `(ctx) => result`, confirmed from the type: `Args extends StandardSchemaWithJSON ? (args, ctx) => ... : (ctx) => ...`)* | `getStats()`, `listProjects()`, `listDocuments({limit: 10})` | Projects list has **no per-project counts** — computing those would be one extra query per project (N+1) for a tool whose entire purpose is being the cheap discovery call; a client that wants one project's count already gets it for free from that project's `list_documents` call's page info (well, cursor mode has no total — see below; if this bites in practice, worth a `get_project`-level count later, not now). |
| `search_vault` | `{ query: string, project_id?: string, tags?: string[], limit?: number }` | `searchDocuments(query, {projectId, tags, limit})` | `limit` clamped to **25 max** in the tool itself (MCP's own ceiling per the strategy doc), independent of `clampLimit`'s REST-facing default of 100. No `search_mode` param — same reasoning as REST. |
| `get_document` | `{ document_ids: string[] (1-5), content?: "none"\|"summary"\|"outline"\|"full", offset?: number, limit?: number }` | `getDocument(id, {includeMarkdown: content === "full" \|\| content === "outline"})` per id | `offset`/`limit` apply only when `content: "full"`, slicing `doc.markdown` and returning `content_range: {offset, returned, total, truncated, next_offset}`. `"outline"` calls `extractHeadings(doc.markdown)` (existing, `lib/vault/title.ts`) and returns headings, not body text. `"summary"` returns `doc.summary` (now selected — see repo addition above); if `summaryStatus !== "ready"`, say so explicitly (`"No summary yet (status: pending)"`) rather than silently returning `null`. |
| `list_documents` | `{ project_id?: string, tags?: string[], limit?: number, cursor?: string }` | `listDocumentsByCursor(...)` (new) | `cursor` is the opaque **base64-encoded** `JSON.stringify({updatedAt, id})` — never expose the raw compound shape in the tool's public contract, so the encoding can change later without breaking clients holding an old cursor value (they just get "invalid cursor" on a corrupt/expired one, decoded defensively). |
| `list_projects` | *(none)* | `listProjects()` | `instructions` deliberately never selected here (that column lives on `getProject`, per the strategy doc — can be long). |
| `get_project` | `{ project_id: string }` | `getProject(id)` | Includes `instructions` — the one place an agent reads a project's own operating notes. |
| `get_related_documents` | `{ document_id: string, limit?: number }` | `getRelatedDocuments(id, limit)` | Must call the Stage 2c RPC path (it already does, unchanged) — never the legacy vault-wide RPC. Empty array for Unfiled/no-siblings docs is correct, not an error (same as REST). |

`search_vault` and `list_documents` stay separate tools, per the strategy doc's own reasoning (ranking vs. enumeration are different needs) — restated here because it's the kind of "why are there two similar tools" question a future reader will ask.

## Prompts (Stage 2e ships one, not two)

**`research_project({project_id})`** — read `get_project` for `instructions`, then `list_documents({project_id})` for the roster, then `search_vault` per question; cite document ids; never invent facts not found in a returned document. This is a static prompt template registered via `server.registerPrompt`, not a tool — it biases the *model's own* behavior toward the safe, grounded path.

`capture_note` is deferred to Stage 4 (see Scope decision above) — do not register it now.

## Error handling in tool responses

Per the strategy doc's auth-wiring rule: **transport/auth failures are HTTP status codes** (handled entirely by `withMcpAuth`, outside any tool); **tool failures are successful JSON-RPC responses carrying `{content, isError: true}`** — never let a `VaultError` thrown inside a tool handler become an uncaught exception that `mcp-handler` turns into an opaque `-32603` the calling model can't act on.

`lib/mcp/errors.ts`:

```ts
export function toolError(err: unknown): CallToolResult {
  if (err instanceof VaultError) {
    return { content: [{ type: "text", text: `${err.code}: ${err.message}` }], isError: true }
  }
  console.error("[vault MCP] unexpected error:", err)
  return { content: [{ type: "text", text: "Unexpected error." }], isError: true }
}
```

Every tool handler body is `try { ...; return {content: [...]} } catch (err) { return toolError(err) }` — the tool-handler mirror of `vaultErrorResponse` from Stage 2d, same shape, different transport.

`get_document` and `get_related_documents` never distinguish "not found" from "belongs to another user" (no existence oracle) — matches REST exactly; `getDocument`/`getProject` already return `null` for both cases via the repo's user-scoped query, and the tool just reports "not found" either way.

## Files

```
app/api/mcp/route.ts              # runtime="nodejs", dynamic="force-dynamic", maxDuration=60
lib/mcp/auth.ts                   # verifyToken() — see Auth section
lib/mcp/context.ts                # resolveUserId(), repoForContext() helper
lib/mcp/format.ts                 # compact JSON shaping for tool output (NOT lib/vault/rest.ts)
lib/mcp/errors.ts                 # toolError()
lib/mcp/tools/overview.ts         # vault_overview
lib/mcp/tools/search.ts           # search_vault
lib/mcp/tools/documents.ts        # get_document, list_documents
lib/mcp/tools/projects.ts         # list_projects, get_project, get_related_documents
lib/mcp/prompts/researchProject.ts
lib/mcp/server.ts                 # registers every tool/prompt on a McpServer instance
```

Deliberately absent (Stage 4, not now): `lib/mcp/writeGuards.ts`, `lib/mcp/tools/write.ts`, `lib/mcp/tools/organize.ts`, `lib/mcp/prompts/captureNote.ts`, any `MCP_WRITE_ENABLED` env var (nothing to gate yet — adding an unused flag now is speculative).

`app/api/mcp/route.ts` shape (the actual Route Handler, wiring the pieces above):

```ts
import { createMcpHandler, withMcpAuth } from "mcp-handler"
import { verifyToken } from "@/lib/mcp/auth"
import { registerVaultServer } from "@/lib/mcp/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const handler = withMcpAuth(
  createMcpHandler(registerVaultServer, { serverInfo: { name: "mdspin-vault", version: "1.0.0" } }),
  verifyToken,
  { required: true }
)

export { handler as GET, handler as POST, handler as DELETE }
```

(`GET`/`POST`/`DELETE` all point at the same handler — the streamable-HTTP MCP transport uses `POST` for JSON-RPC calls, `GET` to open an SSE stream, `DELETE` to end a session; `createMcpHandler` already knows how to route between these internally.)

**No `middleware.ts` change needed** — confirmed live in the current file: the `api/*` exclusion is already broader than Stage 2e's own note asked for (a 2026-08-21 fix, done for a different reason, already covers this).

## Package changes

```diff
- "zod": "^3.24.1"
+ "zod": "^4.2.0"
+ "mcp-handler": "2.1.1"
+ "@modelcontextprotocol/server": "2.0.0"
```

Exact-pinned (no `^`) on the two new packages, per the strategy doc's reasoning: `mcp-handler` 2.x is new enough that a routine `npm update` landing an unreviewed minor is a real risk, not a hypothetical one. `zod` keeps its caret since it's an already-established, stable dependency in this codebase's convention.

## Verification

1. `npx tsc --noEmit` after every task, as always.
2. Unit tests for the two repo additions (`vault-repo.test.ts`, `vault-mappers.test.ts`) and for `lib/mcp/format.ts` / `lib/mcp/context.ts` (pure, testable without a live server).
3. `npx @modelcontextprotocol/inspector` against `http://localhost:3000/api/mcp` with a real `Authorization: Bearer mdspin_...` header — first stop, raw JSON-RPC visibility. Send `Accept: application/json, text/event-stream` per the strategy doc.
4. curl the auth boundary directly: no key / garbage key / revoked key → `401` + `WWW-Authenticate`; valid key → 200 tool list.
5. `claude mcp add --transport http mdspin-vault-dev http://localhost:3000/api/mcp --header "Authorization: Bearer mdspin_..." --scope user` against localhost, then a realistic loop: `vault_overview` → `search_vault` → `get_document` (each content mode) → `list_documents` (paginate with the cursor until it returns `null`, confirm no doc repeats or is skipped) → `get_related_documents` on both a doc with siblings and an Unfiled doc → run the `research_project` prompt end to end on a real project.
6. Repeat the Inspector pass against a Vercel **preview** deploy (a bundling problem with `@modelcontextprotocol/server` on Vercel's runtime would show up here, not on localhost).
7. Explicitly verify `get_related_documents` returns non-empty over the real MCP path for a document known to have related docs — this is the concrete symptom if the `auth.uid()` trap (Trap 3) ever regresses.

## Out of scope (YAGNI, deferred)

`capture_note` prompt, all write tools (`create_document`, `append_to_document`, `update_document`, `organize_document`), `MCP_WRITE_ENABLED`, `mcp_usage`/rate limiting on reads (fail-open is fine for reads per the strategy doc), MCP *resources* (strategy doc already rejected these for Stage 2 — client support is uneven and one resource would just duplicate `vault_overview`), per-project document counts in `vault_overview`, structured `outputSchema` validation on tool results, OAuth (the `AuthInfo.resource`/`expiresAt` fields exist in the type but nothing here sets them — Bearer-API-key-only for now).

