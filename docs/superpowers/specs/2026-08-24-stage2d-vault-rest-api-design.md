# Stage 2d — Vault REST API (`/api/v1/vault/*`) — Implementation Design

**Date:** 2026-08-24
**Status:** Approved design, ready for implementation plan
**Builds on:** Stage 2a/2b (`lib/vault/{types,repo,auth,server,query,errors}.ts`), Stage 2c (dual-auth RPCs — `vault_search_documents`, `find_related_documents`, `vault_stats`, `vault_update_document`).
**Strategy parent:** [MDSpin Knowledge Vault → Cloud Knowledge Hub](/Users/p.trenkner/.claude/plans/MDSpin%20strategy.md), Stage 2d.

## Context & scope decision

The strategy doc's Stage 2d sketch lists a full REST surface (POST/PATCH/DELETE documents, project CRUD, membership endpoints, revisions, tags). `lib/vault/repo.ts` today implements exactly eight operations: `listDocuments`, `getDocument`, `listProjects`, `getProject`, `getRelatedDocuments`, `getStats`, `searchDocuments`, `updateDocument`. Document creation, project CRUD, membership (join-table) endpoints, and revision history don't exist at the repo layer.

**Decision (confirmed with Peter 2026-08-24): mirror the repo exactly.** REST exposes only what `lib/vault/repo.ts` already does. Building the missing write/CRUD surface now would mean inventing write-safety rules (version checks, anti-truncation, revision attribution) on the fly, ahead of Stage 4/5 where the strategy doc deliberately designs them. This keeps Stage 2d pure wiring — no new business logic, no new risk surface.

**Deferred, explicitly, to later stages:** create/delete documents, project CRUD, project membership (many-to-many), reading revision history, a dedicated tags-list endpoint (stats' `top_tags` covers today's need), rate limiting on reads (no plan text calls for it; `lib/rate-limit.ts`'s fail-open model is a different threat model anyway per the strategy doc).

## JSON convention: snake_case at the wire boundary

MDSpin's existing public API (`app/developer-api`) uses snake_case JSON (`file_type`, `word_count`, `converted_at`). The internal `lib/vault` domain types are camelCase (TypeScript convention: `fileType`, `wordCount`). This REST layer converts at the boundary so a Make scenario or MCP client sees one consistent JSON style across MDSpin's entire public surface, not two. Conversion lives in a new pure module, `lib/vault/rest.ts` (see Files below) — never inline in a route handler.

## Auth

Unchanged: `getVaultForRequest(req)` (`lib/vault/server.ts`) resolves `Authorization: Bearer mdspin_...` (API key), `Authorization: Bearer <jwt>` (Supabase JWT), or a session cookie, per Stage 2b's `authenticateRequest()`. No new auth paths.

**One additive change to `lib/vault/auth.ts`/`server.ts`:** thread the API key's row id through so `PATCH /documents/:id` can pass `actorKeyId` to `updateDocument`, letting the revision snapshot correctly attribute an edit to *which* key made it (the column already exists per Stage 2c; today nothing populates it over the API-key path because `authenticateApiKey()` discards `data.id` after validating).

- `AuthResult` (`auth.ts`) gains an optional `keyId?: string`, set only by `authenticateApiKey()`.
- `RequestVault` (`server.ts`) gains the same optional `keyId?: string`, passed through from `AuthResult`.
- No change to `VaultScope` — this is an auth-resolution detail, not a security-scoping one; `scoped()`'s choke-point is untouched.

## Error format

Every route matches the existing `app/api/brief/route.ts` convention: `{"error": "CODE", "message": "..."}` with the status from `VaultError.status` (`AUTH_REQUIRED`→401, `NOT_FOUND`→404, `INVALID_REQUEST`→400, `VERSION_CONFLICT`→409, `NOT_CONFIGURED`→503, `DB_ERROR`→500). A non-`VaultError` thrown inside a handler is logged server-side and mapped to a generic `{"error":"INTERNAL_ERROR","message":"Unexpected error."}` 500 — routes never leak a raw exception message to the caller.

`AUTH_REQUIRED` responses additionally carry `WWW-Authenticate: Bearer` — cheap, spec-correct, and consistent with the curl-based auth-boundary check the strategy doc's own Stage 2 verification section calls for.

Shared error-to-response mapping lives in one place (`lib/vault/http.ts`, see Files) so every route's catch block is one line, not a re-implementation.

## Endpoints

All under `/api/v1/vault/`. All GET except one PATCH. Every handler: `export const runtime = "nodejs"`, `export const dynamic = "force-dynamic"`.

| Method | Path | Repo call | Notes |
|---|---|---|---|
| GET | `/me` | — (reads `scope`/`keyId` only) | `{user_id, auth_method}`. `auth_method` is `"api_key"` when `scope.enforce === "explicit"`, else `"session"` (JWT and cookie are indistinguishable from `scope` alone, and that distinction isn't useful here). |
| GET | `/documents` | `listDocuments(filter)` | Query: `project_id`, `tags` (comma-separated), `search`, `limit`, `offset`. Never returns `markdown` — `listDocuments` doesn't select that column. |
| GET | `/documents/:id` | `getDocument(id, opts)` | `?include=markdown` to get the body; omitted by default. 404 `NOT_FOUND` if `null`. |
| PATCH | `/documents/:id` | `updateDocument(id, patch, opts)` | Body (snake_case in): `title?`, `markdown_text?`, `tags?`, `project_id?`, `expected_version` (required — repo already rejects an empty patch and requires this), `reason?`. `actor` defaults from `scope.enforce`: `"explicit"` → `"api"`, `"rls"` → `"user"`. `actor_key_id` passed from the new `keyId` when present. Returns the updated document. |
| GET | `/documents/:id/related` | `getRelatedDocuments(id, limit)` | Query: `limit`. Empty array (not 404) when the doc has no related docs, is unfiled, or doesn't belong to the caller — matches the RPC's existing no-existence-oracle behavior. |
| GET | `/projects` | `listProjects()` | No filters. |
| GET | `/projects/:id` | `getProject(id)` | 404 `NOT_FOUND` if `null`. |
| GET | `/search` | `searchDocuments(query, opts)` | Query: `q` (required — 400 `INVALID_REQUEST` if missing/blank), `project_id`, `tags`, `limit`, `offset`, `mode` (optional, default `"keyword"`; any other value → 400 `INVALID_REQUEST` — only keyword search exists until Stage 3, but the param is accepted now so Stage 3 adds a value, not a breaking shape change). |
| GET | `/stats` | `getStats()` | No params. |

## Files

- **`lib/vault/query.ts`** (existing, extend) — add two small pure parsers, unit-tested alongside the existing `clampLimit`/`clampOffset`/`escapeIlikeTerm`:
  - `parseTagsParam(raw: string | null): string[] | undefined` — comma-split, trim, drop empties, `undefined` if nothing usable.
  - `parseNumberParam(raw: string | null): number | undefined` — `undefined` for `null`/unparsable, otherwise `Number(raw)` (feeds straight into `clampLimit`/`clampOffset`, which already tolerate `NaN`).
- **`lib/vault/rest.ts`** (new, pure, unit-tested) — the domain→wire boundary: `documentToJson(doc)`, `projectToJson(project)`, `relatedDocumentToJson(doc)`, `searchResultToJson(result)`, `statsToJson(stats)`, `pageToJson(page, itemMapper)`. Every field renamed to snake_case here and nowhere else.
- **`lib/vault/http.ts`** (new, server-only) — `vaultErrorResponse(err: unknown): NextResponse`, the one place that maps `VaultError` → `{error,message}` + status (+ `WWW-Authenticate` on 401) and anything else → generic 500. Every route's catch block calls this.
- **`lib/vault/auth.ts`** (existing, extend) — `authenticateApiKey()` returns `keyId: data.id` on `AuthResult`; the JWT/cookie branches leave it `undefined`.
- **`lib/vault/server.ts`** (existing, extend) — `RequestVault` gains `keyId?: string`, passed through from `authenticateRequest()`.
- **Route handlers** (new): `app/api/v1/vault/me/route.ts`, `.../documents/route.ts`, `.../documents/[id]/route.ts`, `.../documents/[id]/related/route.ts`, `.../projects/route.ts`, `.../projects/[id]/route.ts`, `.../search/route.ts`, `.../stats/route.ts`. Each: `getVaultForRequest(req)` → parse query/body → call the matching repo method → `NextResponse.json(mapper(result))` → catch → `vaultErrorResponse(err)`. Target ~15 lines per handler per the strategy doc's own guidance.

## Testing

- **Unit (`lib/__tests__/vault-query.test.ts`, extend):** `parseTagsParam`/`parseNumberParam` — empty string, whitespace-only, `null`, mixed garbage.
- **Unit (`lib/__tests__/vault-rest.test.ts`, new):** every `*ToJson` mapper — field renaming, `null` passthrough, `pageToJson` envelope shape (`has_more`/`next_offset` naming, matches `buildPage`'s existing semantics).
- **Unit (`lib/__tests__/vault-http.test.ts`, new):** `vaultErrorResponse` — one case per `VaultErrorCode` → correct status, `WWW-Authenticate` present only on `AUTH_REQUIRED`, non-`VaultError` → generic 500 with no leaked message.
- **Manual, against `npm run dev` with a real API key:**
  - `GET /me` with a valid key, a garbage key, a revoked key, no key → correct `user_id`/401s, `WWW-Authenticate` present.
  - `GET /documents` — filter by `project_id`, by `tags`, by `search`; confirm `markdown` is absent; confirm pagination (`limit`/`offset`/`has_more`/`next_offset`) against a vault with more docs than one page.
  - `GET /documents/:id` — with and without `?include=markdown`; a foreign/nonexistent id → 404.
  - `PATCH /documents/:id` — correct `expected_version` → 200 + new `version`; stale `expected_version` → 409 with both versions in the message; missing `expected_version` → 400; edit via API key → confirm `document_revisions.actor_key_id` is populated (the concrete proof the `keyId`-threading change works).
  - `GET /documents/:id/related` — a doc with related docs, and an Unfiled doc (expect `[]`, not an error).
  - `GET /projects`, `GET /projects/:id` — including a foreign project id → 404, not another user's data.
  - `GET /search?q=...` — a real phrase; `mode=hybrid` (or any non-`keyword` value) → 400; missing `q` → 400.
  - `GET /stats` — counts match what the vault UI shows for the same account.

## Out of scope (YAGNI, deferred to later stages)

Document creation/deletion, project CRUD, project membership (many-to-many join endpoints), revision-history reads, a standalone tags-list endpoint, rate limiting on these reads, response caching, OpenAPI/schema generation, webhook/event delivery.
