# Auto-file GitHub-synced docs into the right project

## Context

The GitHub integration drops every newly-synced document into Unfiled
(`conversions.project_id = NULL`) by explicit design — the live-sync feature
intentionally left project filing to the user
(`docs/superpowers/specs/2026-09-16-live-source-sync-github-design.md`). That
was fine when sync was new, but with the integration active day-to-day, every
new doc landing as Unfiled with no explanation is friction: the user has to
notice it arrived, guess where it belongs, and file it manually with no
record of what showed up or when.

The goal: automatically file new GitHub docs into the right project, and give
the user a persistent, readable record of what arrived and what got filed —
including when the system created a brand-new project — so nothing lands
silently.

Two prior attempts at automated document organization exist in this
codebase, both reversed: a numeric relatedness signal (TF-IDF + embeddings)
that didn't discriminate well on the real vault, and an LLM-adjudication
feature for the Knowledge Map that was built, tested, and pulled the same day
for product-philosophy reasons ("the Map should not be an analysis
feature"). Neither directly disqualifies this feature — both were about a
*browsing/analysis* surface, not a one-time *filing* decision at ingestion —
but it's why the design leans on a cheap deterministic pass before ever
calling an LLM, and treats "not confident" as "leave it alone and say so"
rather than guessing.

Repo names rarely match project names 1:1, so in practice the LLM step is the
workhorse for most docs, not a rare fallback — confirmed with the user, who
also confirmed Make credit cost is not a constraint here.

## Classification pipeline

For every `conversions` row with `source_type = 'sync'` and
`project_id IS NULL` after insert:

1. **Deterministic path match** (no LLM call) — `lib/vault/filing.ts`'s
   `matchProjectByPath`: normalize the GitHub repo name and the doc's
   path-within-repo, compare against existing top-level project names
   (`parent_id IS NULL`). A match files immediately with no network call.
2. **LLM fallback** (expected to fire for most docs) — send the doc content
   plus the candidate project list to the `MDSpin Filing` Make scenario
   (same shape as the existing summary/brief scenarios: Custom Webhook →
   `ai-tools:Ask` → `WebhookRespond`, with the same shared-secret filter).
   The scenario returns a JSON decision (`match` / `new` / `none`) with a
   confidence, delimited the same way `SUMMARY_DELIMITER` is (Make has no
   `toJSON()` and strips response headers, and a blocked filter still
   answers 200 "Accepted" — see `lib/vault/filing.ts`'s header comment).
   - High-confidence `match` → file into that project.
   - High-confidence `new` → create the project (`projects.auto_created =
     true`), file into it.
   - Anything below the confidence bar, or `none` → leave `project_id` NULL,
     `filing_status = 'flagged'`, with the guess stored in `filing_note` /
     `filing_confidence` (and `filing_suggested_project_id` when there's a
     concrete project to offer a one-click "File into X" for).

Subproject/folder assignment stays manual — this only decides the top-level
project.

## Trigger points

- **New pushes**: inline-drained from `app/api/webhooks/github/route.ts`'s
  existing `after()` background flow, right alongside the summary/embedding
  inline drains, using `claim_filings_by_id_for_user` (service-role, no
  `auth.uid()`) scoped to the push's own touched ids.
- **Existing Unfiled backlog**: a user-triggered "Filing backfill" banner
  (`components/vault/filing-backfill-banner.tsx` +
  `components/vault/use-filing-drain.ts`), modeled directly on the
  summary/embedding backfill banners. There is deliberately no cron
  backstop — backfill is a manual step so a stale backlog doesn't dump a
  wall of filed/flagged notifications unprompted.

## Data model

Migration `20260923000000_vault_filing_pipeline.sql` added:

- `conversions.filing_status` (`pending | running | filed | flagged |
  failed`), `filing_confidence`, `filing_note`,
  `filing_suggested_project_id`, `filing_claimed_at`, `filing_decided_at`,
  `filing_attempts`. No column-wide default — only `source_type='sync'`
  rows without a project ever get a value; every other write path already
  has an explicit filing decision.
- `projects.auto_created boolean default false`.
- Claim RPCs `claim_pending_filings` / `claim_filings_by_id` (RLS-scoped) and
  `claim_filings_by_id_for_user` (service-role), mirroring the summary
  pipeline's claim shape exactly — `FOR UPDATE SKIP LOCKED`, a 10-minute
  stale-claim reclaim window, and the claim (not the worker) owning the
  attempt increment.

## Code

- `lib/vault/filing.ts` — pure helpers: payload assembly, path matching,
  response parsing, confidence thresholds, retry state machine. Fully unit
  tested (`lib/__tests__/vault-filing.test.ts`).
- `lib/vault/classify-document.ts` — the I/O orchestrator shared between the
  webhook's inline drain and the manual backfill route
  (`lib/__tests__/vault-classify-document.test.ts`).
- `app/api/vault/filing/run` + `.../status` — the backfill banner's drain
  and status-check routes, mirroring `app/api/vault/summaries/*` exactly.
- `components/dashboard/filing-activity.tsx` — a dashboard card surfacing
  recent filed/flagged GitHub docs, reusing the `vaultDocs` window
  `use-dashboard.ts` already fetches (no dedicated query). Renders nothing
  when there's no GitHub filing activity to report.
- A "New" badge (`isRecentlyAutoCreated` in `lib/library.ts`) on
  auto-created projects in the folder grid and the dashboard's projects
  rail, for 7 days after creation.
- The Unfiled list view shows a flagged row's guess inline (`filing_note`),
  with a one-click "File into X" when `filing_suggested_project_id` is set
  (`components/library/vault-list-view.tsx`, `use-library.ts`'s new
  `moveOneTo`).

## Configuration

The whole pipeline is gated behind `MAKE_FILING_WEBHOOK_URL` /
`MAKE_FILING_SECRET` being set, exactly like the summary/embedding
pipelines' `NOT_CONFIGURED` gate — until the Make scenario exists and the
env vars are set (Production + Preview), every sync doc simply stays
`filing_status = 'pending'` and nothing is claimed, rather than partially
running with an attempt budget draining against nothing.
