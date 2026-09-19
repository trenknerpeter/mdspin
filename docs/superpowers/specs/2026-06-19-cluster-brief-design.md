# Cluster Brief ("Brief me on this + related") — Implementation Design

**Date:** 2026-06-19
**Status:** Approved design, ready for implementation plan
**Builds on:** connection-on-save (the relatedness engine: `find_related_conversions` RPC + `findRelatedSpins`).
**Strategy parent:** Vault Moat Strategy — **Layer 1, Level 3** ("the vault does my work").

## Context & the idea behind "brief"

A "related docs" list is plumbing. The payoff is the vault *producing* something only it can: a **cross-document synthesis**. The brief is **not** a summary of the doc you're viewing — single-doc summarization is table stakes (NotebookLM/ChatGPT do it) and wouldn't use the relatedness engine at all. Instead, viewing a doc, the brief synthesizes **that doc + its related docs** into one picture: shared facts, themes, and especially **contradictions/gaps that live *between* documents** — something no single-doc summarizer can produce.

The brief is **anchored on the doc you're viewing** ("this doc, in the context of everything related") and is a **derived property of that doc**, not a separate vault record. (A future, bigger step — "brief me on a topic/entity" independent of any one doc — is explicitly out of scope here.)

## Decisions (from brainstorm)

- **Cross-doc synthesis, doc-anchored (Vision 2a).** Synthesize source + related cluster; store the result *on the source doc*.
- **No new vault record.** The brief is a column on `conversions`, not a new row — avoids vault duplication.
- **Synthesis runs through Make.** Frontend → Make webhook (sync) → AI module → brief back. LLM credential lives in Make; frontend holds only a webhook URL.
- **Make scenario scaffolded via the Make MCP**; user attaches their own LLM connection.
- **Requires related docs.** Button hidden/disabled when the doc has 0 related docs (nothing to synthesize across) — no single-doc fallback.

## Schema (Supabase MCP migration; record in `supabase/migrations/`)

Add two columns to `public.conversions`:
```sql
alter table public.conversions
  add column if not exists brief text,
  add column if not exists brief_generated_at timestamptz;
```
No new table, no new rows. The brief is a nullable derived attribute of the doc.

## Architecture & data flow

1. Detail panel shows a **"Brief"** section. With no brief yet and ≥1 related doc → a **"Brief me on this + related"** button. (Hidden if 0 related.)
2. Click → `POST /api/brief { sourceId }`.
3. **`/api/brief` route** (server, authed via the cookie Supabase session — RLS applies):
   a. Fetch the source row; run `find_related_conversions(sourceId)`; fetch related docs' `title`/`markdown_text`.
   b. If 0 related → `422` (button shouldn't allow this, but guard anyway).
   c. Assemble the cluster payload (source first; each doc's markdown capped).
   d. POST to the Make webhook (`MAKE_BRIEF_WEBHOOK_URL`, server-side, shared-secret header); receive `{ brief }`.
   e. `UPDATE` the source row: `brief = <text>`, `brief_generated_at = now()`.
   f. Return `{ brief, brief_generated_at }`.
4. Client updates the open doc's brief in place and renders it. On error, the section shows a retry message; nothing is persisted.

Why server-side: keeps large markdown off the client, makes synthesis→persist atomic, client stays thin (`{ sourceId }` in). Mirrors the existing `/api/convert` proxy pattern.

## Make scenario contract (scaffolded via MCP)

**Request** (frontend → webhook), JSON, header `x-mdspin-secret: <shared>`:
```json
{ "topic": "Acme Corp Q3 Pricing Proposal",
  "docs": [ { "title": "...", "markdown": "..." }, ... ] }   // source first, then related
```
**Scenario:** Custom Webhook → AI module (user's LLM) → Webhook Response.
**Prompt (intent):** "Synthesize a single cross-document brief about {topic} from these related documents. This is NOT a summary of one document — combine across them. Output concise markdown: **Summary**, **Key facts**, **Themes**, **Contradictions / gaps** (call out where docs disagree or leave questions), **Open questions**. Prefer specifics from the docs."
**Response:** `{ "brief": "## Summary\n..." }`
Setup note: Make learns the webhook payload from the first call — send one sample cluster during scaffolding, then map fields into the AI module. The Webhook Response module makes the reply synchronous.

## Presentation & surfacing (this is a flagship feature — show it well)

- **Brief-first in the panel.** When a brief exists it renders **above** the raw Preview (synthesis first, raw text second), styled as a real document (prose typography like Preview), with the **Contradictions / gaps** part visually emphasized — that's the "whoa" beat.
- **Widen the panel when a brief is present.** The detail Sheet is normally `sm:max-w-md`; when showing a brief, widen it (e.g. `sm:max-w-2xl`) so it reads like a document, not a cramped note.
- **Inviting empty state, not a tiny button.** A doc with ≥1 related doc and no brief shows a prominent CTA — *"✦ Synthesize a brief from N related docs"* — explaining the value. Hidden entirely when 0 related docs.
- **Discoverability in the vault list.** A **"✦ Brief" chip** appears on each vault-list row whose doc has a brief, so the feature is visible at a glance without opening every doc.
- **Generation beat.** On completion, scroll/bring the brief into focus rather than silently swapping a section.

## Files / components

- **`lib/brief.ts`** (pure, unit-tested): `assembleClusterPayload(source, related, capChars)` → `{ topic, docs }` (source-first, markdown capped, shape).
- **`app/api/brief/route.ts`** — POST `{ sourceId }`; server Supabase (authed); assemble → Make → `UPDATE` row → return `{ brief, brief_generated_at }`. `runtime: "nodejs"`, `maxDuration: 60`.
- **`lib/library.ts`** — add `brief` + `brief_generated_at` to the `Spin` interface and `SPIN_FIELDS`. (Acceptable to pull `brief` into the list query at current scale — same "cheap at current scale" stance as `listSpinStats`; the row chip keys off `brief_generated_at` presence.)
- **`components/library/cluster-brief-section.tsx`** — the panel's Brief block: empty-state CTA (only if `relatedCount > 0`), loading, rendered brief (markdown via `remark`) + "generated <relative time>" + **Regenerate**. Calls `/api/brief` and patches local state on success.
- **`components/library/spin-detail-panel.tsx`** — render `<ClusterBriefSection>` **above** the Preview section; widen the Sheet when a brief is present; pass `brief`/`brief_generated_at`, the related count (from `RelatedSpins`/a count), and a patch callback.
- **`app/app/vault/page.tsx`** — render a "✦ Brief" chip on list rows where `brief_generated_at` is set.
- **Env:** `MAKE_BRIEF_WEBHOOK_URL` (+ `MAKE_BRIEF_SECRET`) in `.env.local` and `.env.example`.

## Staleness

The brief reflects the cluster *at generation time*; if related docs change, it can drift. `brief_generated_at` + a **Regenerate** control handle this. No automatic invalidation in v1.

## Error handling

- `MAKE_BRIEF_WEBHOOK_URL` unset → `503` "brief synthesis not configured."
- Make non-200 / timeout / malformed (no `brief`) → `502`; section shows "Couldn't generate a brief, try again."
- 0 related docs → `422`; button is hidden in that case anyway.
- DB update fails after a good generation → return the brief with a `saved:false` flag; section shows it with Copy so work isn't lost.

## Testing

- **Unit (vitest, `lib/__tests__/brief.test.ts`):** `assembleClusterPayload` — source-first ordering, markdown capping, payload shape, topic = source title.
- **Route + Make + UI:** manual via the running app once the Make scenario + env URL exist (independent of the broken `BACKEND_API_KEY`); route mockable. Verify: brief generates for an Acme doc, persists on the row, renders in the section, survives reload; the brief is genuinely cross-doc (mentions related docs' content/contradictions); button hidden on a doc with no related; error states behave.

## Out of scope (YAGNI)

Single-doc summaries, topic/entity-level briefs ("brief me on Acme" independent of a doc), automatic staleness invalidation, streaming output, async/queued generation, brief versioning/history.
