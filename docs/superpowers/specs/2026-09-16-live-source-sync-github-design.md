# Live Source Sync — Stage 1 (GitHub)

**Date:** 2026-09-16 (shipped 2026-09-16 – 2026-09-19)
**Status:** Shipped
**Builds on:** Stage 2a–2e vault repo layer (`lib/vault/repo.ts`, `createVaultRepo`), Stage 4 MCP writes (`document_revisions`, actor-scoped writes), the Cloud Knowledge Hub strategy's "shared repo core, injected client" decision.

## Context

The Knowledge Vault is a **snapshot store**. You upload a document and it sits there; the
source keeps moving and the vault silently goes stale. Nothing in the schema records where a
document came from, so there is no way to notice a change even in principle.

The goal is a vault that **stays current on its own**: connect a source once, and new and
changed documents flow in without anyone touching the app.

Three decisions were made up front:

1. **Build the spine once, expose it twice.** One shared foundation (external identity,
   upsert, mirror policy), then *one* native connector to prove it end to end, plus a Make
   bridge later so all other sources are reachable without building four more OAuth clients.
2. **GitHub goes first.** Its content is already markdown (zero conversion), its webhooks say
   exactly which files changed, and there is no app-verification gate. It is the cheapest way
   to prove the spine is correct. Google Drive — the better persona fit for MDSpin's actual
   non-technical target user — is deliberately deferred because broad Drive access sits behind
   Google verification, an external gate that can't be compressed. GitHub is a known,
   explicitly accepted trade-off: cheapest to build, worst fit for the target user, chosen to
   de-risk the sync engine itself before spending on a harder connector.
3. **Linked documents are read-only mirrors.** The source owns body and title. Tags and
   project filing are yours. To edit the body you *detach*, which permanently unlinks one
   document (or disconnects the whole connection, which detaches every member document).

### Explicitly out of scope for Stage 1

- **Airtable.** Records are rows, not documents; "sync my base" is a different feature.
- **Notion / Drive / Confluence native connectors.** These arrive via the Make bridge (Stage 2).
- **Make app changes.** `mdspin-makeapp.json` lives outside this repo and publishes separately.
- **Writing back to the source.** Sync is strictly one-directional, inbound.
- **A repo-picker UI.** An installation must grant access to exactly one repository; more than
  one is rejected with a message pointing at GitHub's own repo-access screen.

### Correction to the throughput decision

The initial instinct was "drain inline, cron catches the tail." That is right for *ongoing*
changes — a 5-file push gets summarized in seconds. It does **not** work for the initial
backfill: the cron drains 3 documents/day (`CRON_LIMIT = 3`, two daily crons, the Vercel Hobby
ceiling), so a 300-document repo would take 100 days, and a repo changing 5 files/day would
make the queue grow forever.

So the shipped design keeps inline draining for changes, and **does not enqueue summaries
during backfill** — backfilled docs land as `summary_status = 'manual'` with a "Summarize
these" button. `'manual'` already means "drainers skip this" everywhere in the codebase.

---

## The seven problems this design had to survive

These were found by adversarially reviewing the design *before any code was written*, then
verified against the live schema. Each one would have silently broken sync if ignored.

| # | Problem | Fix |
|---|---|---|
| 1 | `conversions_user_content_hash_key` is a unique index on `(user_id, content_hash)`. Writing `content_hash` on synced rows would make file renames, duplicate-content files, and "I already uploaded this folder" all fail with `23505`. | Never write `content_hash` on synced rows. New non-unique `source_content_hash` column drives change detection instead. |
| 2 | `claim_summaries_by_id` is `security invoker` filtering on `auth.uid()`. Called from a service-role worker it returns **zero rows, no error**. | New sibling RPC (`claim_summaries_by_id_for_user`) taking an explicit `p_user_id`. |
| 3 | Backfill of 300 docs against a 3/day drain never converges, and starves every pre-existing pending document. | Backfill sets `summary_status = 'manual'`; the global drain's `ORDER BY` was also fixed to FIFO on `least(converted_at, updated_at)`. |
| 4 | The vault UI saves via `updateSpin` (`lib/library.ts`) — direct PostgREST, never through `lib/vault/repo.ts`. A repo-layer mirror guard would be decorative. | Enforce in a `BEFORE UPDATE` trigger on `conversions`, with a session-var bypass (`mdspin.sync_write`) the sync RPC sets inside its own transaction. |
| 5 | GitHub's webhook delivery timeout is 10s; a long inline drain inside the handler marks every delivery failed. | Webhook returns 202 in <1s, work continues in `after()`. |
| 6 | `?installation_id=` in the OAuth callback is attacker-suppliable. Since tokens are minted from the *app's* key, a forged id would read someone else's private repo. | Verify via `GET /user/installations` (the connecting user's own token) before trusting an installation id, plus a unique `(provider, external_account_id)` index. |
| 7 | `checkExistingContentHashes` (`lib/vault/commit.ts`) has no `source_type` filter — if synced rows carried `content_hash`, the browser uploader would misreport every synced file as a duplicate. | Fixed for free by #1 — synced rows keep `content_hash` NULL. |

A security bug not caught by review was found by **live-testing the disconnect RPC against the
hosted database before shipping**: the first version scoped ownership by `auth.uid()` alone,
which is `NULL` under the service-role/API-key path — meaning `auth.uid() is null or
auth.uid() = sc.user_id` was true for *every* connection, and an API-key caller could disconnect
(and detach the documents of) another user's connection. Fixed by taking an explicit
`p_user_id`, matching every other RPC in this schema (`vault_update_document`,
`vault_organize_document`, etc.). Both the buggy and fixed versions are preserved in the
migration history (`20260916000004_disconnect_source_connection.sql` and
`20260916000005_disconnect_source_connection_fix.sql`) — that's what actually happened, and the
fix's own comment only makes sense next to what it fixed.

---

## Schema

`public.source_connections` — one row per connected repo+branch. `provider`,
`display_name`, `config` (jsonb: `{owner, repo, repo_id, branch, path_prefix,
backfill_cursor}`), `external_account_id` (the GitHub App installation id — non-secret,
GitHub-controlled, never proof of ownership on its own), `status`, `last_synced_sha`,
`last_synced_at`, `last_error`. `unique(id, user_id)` enables a composite FK from
`conversions`; `unique(provider, external_account_id)` blocks a forged installation id from
creating a second connection to the same installation under a different account.

New columns on `public.conversions`: `source_connection_id`, `external_id` (e.g. a
repo-relative path), `external_url`, `source_content_hash` (change detection only, no unique
constraint), `source_synced_at`, `source_link_state` (`linked` / `detached` / `missing`).
`source_type` gains `'sync'`; `document_revisions.actor` gains `'sync'`.

**`vault_upsert_synced_document`** is the idempotent upsert spine — the single place the
insert/adopt/update/skip decision lives, so the mirror-guard bypass and the write it protects
happen in one transaction:

| Match on `(connection_id, external_id)` | Action |
|---|---|
| None found | Insert. `source_type='sync'`, `content_hash=NULL`. |
| Found, `source_link_state='detached'` | Skip — the user took ownership. |
| Found, `source_content_hash` unchanged | No-op (`{changed: false}`) — stops a re-push from re-summarizing everything. |
| Found, hash changed | Update body/title/hash. `project_id` and `tags` are omitted from the `SET` list entirely — they're the user's. |

Before inserting fresh, it **adopts by hash**: a hand-uploaded row with a matching
`content_hash` is claimed (hash nulled, connection/external_id attached) instead of creating a
duplicate — the single most likely real journey being "I already uploaded this folder, now I'm
connecting the repo it lives in."

No `document_revisions` snapshot is written on any branch: a fresh insert has nothing to
snapshot, an adopted row's body is by definition identical to what's being written, and an
update-on-change is only reachable once a row is already `sync`+`linked` — which the guard
trigger has kept immutable to every writer but this function, so the pre-image was itself a
prior sync write, never user content. GitHub's own commit history is the revision log for
synced content.

**`conversions_enforce_source_link`** (`BEFORE UPDATE` trigger): rejects a `markdown_text` or
`title` change on a `linked` row with a connection attached, unless
`current_setting('mdspin.sync_write', true) = 'on'` — a plain `SET LOCAL` only the sync RPC
sets, inside its own transaction, that resets automatically at commit.

---

## GitHub connector

**GitHub App, not OAuth App** — the user picks exactly which repo(s) to grant, and
installation access tokens are minted on demand from `GITHUB_APP_PRIVATE_KEY` (RS256 JWT via
`node:crypto`, GitHub issues PKCS#1 keys which WebCrypto rejects), live one hour, and **never
touch the database**. Only the installation id does, and it's non-secret.

**Connect flow** (`app/api/integrations/github/callback`): exchanges the one-time OAuth `code`
for a user access token, calls `GET /user/installations` to prove the connecting user actually
controls the installation, discards that token immediately, then requires the installation to
grant access to exactly one repo (more than one → `select_one_repo` error with a deep link to
GitHub's own repo-access screen for that installation, added after real use surfaced how
confusing GitHub's default "All repositories" install option is without one).

**Webhook** (`app/api/webhooks/github`): HMAC-SHA256 signature verification
(`lib/integrations/github/webhook-signature.ts`, deliberately kept outside the `server-only`
boundary so it's unit-testable), returns 202 in under a second, all real work in `after()`.
Push resolution (`lib/integrations/github/changes.ts`) treats `commits[]` as a fast path only —
it's capped at 20 entries regardless of the true commit count — and falls back to
`GET .../compare/{before}...{after}` or a full tree re-scan on `forced`, `created`, or a
truncated `commits[]`.

**Backfill**: lists the tree once, filters to in-scope markdown files (capped at
`MAX_SYNC_FILES = 300`, refused loudly rather than silently truncated), and processes it in
`GITHUB_BACKFILL_BATCH_SIZE = 25`-file chunks via a cursor persisted on the connection —
resumable across Vercel's 60s function ceiling rather than one long request racing it.

---

## UI

`/app/integrations` — connection cards (repo, branch, status, last synced) with Pause/Resume,
Disconnect, Continue backfill, and Summarize backfilled docs. `spin-detail-panel.tsx` shows a
synced-document badge linking to the source and a "Detach to edit" action; the editor is
disabled while linked (the trigger is the real enforcement — this just avoids offering an edit
that would fail).

---

## Post-ship fixes (found through real use, both same-day)

1. **Frontmatter never parsed.** `upsertSyncedDocument` derived the title from an H1 search
   over the *raw* file (frontmatter still attached) with the filename fallback hardcoded to
   `null`. A blog/docs repo that puts its title only in YAML frontmatter — the common
   shape — produced "Untitled note" for every such file, and stored the YAML fence as visible
   document content. Fixed to split frontmatter first (matching `buildIngestDoc`'s existing
   convention), derive title from frontmatter → H1 → the file's own name, and store the
   stripped body. The 10 documents already synced under the old logic were repaired directly
   against the database, since a future sync would correctly report them "unchanged" (the
   source content hadn't changed) and never touch them again.
2. **`select_one_repo` was a dead end.** The original error message had no way to act on it.
   The callback now carries the repo count and installation id back to the page, which links
   straight to GitHub's Configure screen for that installation.

## Verification

Schema and RPC behavior were verified live against the hosted database (ref
`ixdsddfxkrkytiitfici`) before and after each fix — insert/no-op/update/adopt/detach-skip, the
mirror guard rejecting a raw `UPDATE` and allowing one with the bypass set, and the disconnect
ownership fix rejecting a cross-user call. End-to-end: a real connection to this repo
(`trenknerpeter/mdspin`) backfilled all 12 tracked markdown files correctly on the first run
after the frontmatter fix.

