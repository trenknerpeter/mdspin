# Analytics & funnel audit — September 2026

**Trigger:** MDSpin has been free since launch, with only a $2.99 "buy me
coffee" Stripe product and no purchases to date. Before deciding on pricing,
Peter wanted to know what was actually happening inside the app — DAU/MAU,
feature adoption, whether people convert in-app or on the website, whether
anyone hits the free-tier limits. The honest starting point was: almost no
visibility at all.

This document is a record of what was found and what was changed. Commits
referenced below are on `main`, range `7439827..de2084d`.

## Starting assumption vs. what the data showed

The working assumption going in was that PostHog wasn't loading for most
visitors, because the Usercentrics consent banner gated `posthog.init()`
behind an opt-in "Functional" category that defaulted to denied. That was
true and worth fixing, but checking the actual event volume in PostHog told a
different story: **5,018 unique visitors were tracked over 90 days**, and
browser-reported conversions (198) slightly *exceeded* the database's metered
count (143) — meaning most visitors were clicking "Accept All." Consent loss
was real but modest, not the dominant problem.

The dominant problems were three specific bugs, plus one structural gap:

1. **A silent server-side data-loss bug.** `lib/posthog-server.ts` cached one
   `PostHog` client as a module-level singleton, and every route handler
   called `await posthog.shutdown()` after sending an event. On a warm
   serverless instance, the *first* event killed the client; every later
   event from that instance vanished with no error. `checkout_initiated` had
   2 lifetime events; `conversion_rate_limited` stopped appearing entirely
   after 2026-09-09.

2. **The rate-limit event was wired to the wrong route.**
   `conversion_rate_limited` — the nearest thing to a willingness-to-pay
   signal — only fired from `/api/convert` and `/api/convert/url`. The
   browser's actual upload path is `/api/convert/batch`, which never emitted
   it. The most pricing-relevant event in the codebase had never fired on a
   real user action.

3. **Identity was only asserted at the sign-in form.** `posthog.identify()`
   ran once, on form submit. Google OAuth (a redirect flow) never called it,
   and a returning user with an existing session was never identified on page
   load. Of 170 conversion-start events on `/app` (a route unreachable while
   logged out) only 82 carried an identified person — the rest were recorded
   as anonymous. There was also no `posthog.reset()` on sign-out, so a shared
   browser could merge a new visitor into the previous user's identity.

4. **The Knowledge Vault was almost entirely uninstrumented.** One event,
   `vault_document_ingested`, covered the whole surface — no events for
   projects, subprojects, tags, Map view, search, or GitHub sync. This part
   of the original assumption held up: vault adoption really was invisible.

## What was built

### Layer 0 — Removed Usercentrics (`91560ee`)

The CMP was a pilot Peter no longer wanted. Removed entirely; PostHog now
boots for every visitor via `instrumentation-client.ts`, configured
**cookieless** (`persistence: "memory"`, `person_profiles: "identified_only"`)
so no consent banner is required under most EU readings — no cookies are set
for anonymous visitors. Verified live: zero cookies, `/ingest` fires with no
interaction.

Consequence: with memory-only persistence, a visitor's distinct id resets on
every full page load. This made the identity fix (below) load-bearing rather
than a nice-to-have.

### Layer 1 — Database-backed metrics (`4e7a66e`)

Vault actions (create a project, tag a document, drag a node on the Map) go
**browser → Supabase directly**, bypassing the app's own server entirely — no
analytics event can ever see them. But every action leaves a row. So instead
of waiting months for new events to accumulate, five SQL views were created
directly on the hosted Supabase project (`ixdsddfxkrkytiitfici`), answering
retroactively across *all* existing history:

- `metrics.user_adoption` — per-user feature usage
- `metrics.activity_daily` — DAU/WAU/MAU, signed-in vs. anonymous
- `metrics.funnel_activation` — signup → converted → used vault → made a project, by signup week
- `metrics.feature_reach` — % of activated users who ever touched each feature
- `metrics.quota_pressure` — who has ever hit the free-tier ceiling

Exposed to the app through one `SECURITY DEFINER` Postgres function
(`public.metrics_snapshot()`), executable only by the service role, and
rendered at `/app/admin/metrics` — gated by a new `ADMIN_USER_IDS` env var. A
non-admin gets a 404, not a 403, so the page doesn't even reveal it exists.
Six unit tests cover the fail-closed paths (unset var, empty var, missing
user id).

**What it showed**, excluding the maker account, across 59 other users:
30 never converted anything; 29 converted at least once; 9 ever had a vault
document; 4 ever created a project; **0** ever created a subproject, opened
the Map with a saved position, or connected GitHub. Signed-in MAU: 11.

### Layer 2 — Server-side event fixes (`4e7a66e`)

- `getPostHogClient()` is no longer exported; the shared client can no longer
  be shut down by a caller. Replaced with `trackServer()`, which flushes via
  `after()` and never shuts down. A regression test simulates three events in
  a row against one warm client, which a single-event test cannot catch.
- `conversion_rate_limited` moved onto `/api/convert/batch`, plus new events:
  `conversion_succeeded`/`conversion_failed`, `vault_api_read`/`write`,
  `mcp_tool_called`, `github_sync_ran`/`failed`, `summary_generated`,
  `brief_generated`.
- Anonymous server events are never given a persistent identity (no
  IP-derived person id) — that would reintroduce the tracking the consent
  removal was meant to avoid. They're counted with a random per-event id and
  `$process_person_profile: false`.

### Layer 3 — Client-side fixes

- Identity now asserted in `components/auth-provider.tsx` on **every mount**
  where a user is present, not only at sign-in — fixes Google OAuth and
  returning sessions. `posthog.reset()` added on sign-out.
- Event names centralized in `lib/analytics/events.ts` (previously ~20 inline
  string literals with inconsistent quoting).
- New client events for the vault actions that leave no database row:
  `vault_map_opened`, `vault_search_performed`, `vault_tag_filter_applied`,
  `related_document_opened`.
- `/ingest` excluded from `middleware.ts` — it was routing every analytics
  beacon through a needless Supabase auth round-trip.

### Local traffic guard (`5737982`)

Found *after* the above had shipped: PostHog's own `internal_or_test_user_hostname`
setting only *tags* a person, it doesn't drop the event — localhost was the
second-largest "host" in the project, ~1,400 of ~12,600 events over 90 days
(12%). Added an explicit guard so PostHog doesn't initialize at all on
`localhost`/`127.0.0.1` unless `NEXT_PUBLIC_POSTHOG_LOCAL=1` is set.

### PostHog dashboards

Two dashboards built via the PostHog API, all tiles with the project's
internal/test-user filter applied (which was also extended to include
`p.trenkner@make.com` and PostHog's own `$internal_or_test_user` flag):

- **[In-product usage](https://eu.posthog.com/project/178680/dashboard/965820)**
  — WAU, conversion funnel, where conversions start, quota pressure,
  browser-vs-server conversion gap, LLM feature usage.
- **[Knowledge Vault](https://eu.posthog.com/project/178680/dashboard/965843)**
  — vault-reach funnel, per-surface pageviews, what people click inside the
  vault (autocapture — retroactive, no instrumentation needed), search
  effectiveness, machine (API/MCP) writes.

Vault *content* (doc/project/tag counts) deliberately isn't duplicated here —
that's `/app/admin/metrics`'s job, and it's the more trustworthy source.

## The funnel finding, and what it led to

With the fixes shipped, the obvious next question was the site-wide numbers
themselves: 5,018 visitors → 77 conversion starts (1.5%) → 46 completions
(0.9%). Breaking sessions down by entry point resolved it immediately:

| Entry point | Sessions (90d) | Reached a converter | Started a conversion |
|---|---|---|---|
| Blog / guides | 4,906 | 1.6% | 0.8% |
| Homepage | 300 | 83% | 18% |
| Other | 245 | 46% | 13.5% |

The site-wide rate wasn't one weak funnel — it was two audiences averaged
together. The homepage converts well. But 90% of all traffic (organic search
landing on `/blog/*` and `/guides/*`) hit a page with **no converter and no
CTA to one anywhere in the template**. `/convert/[slug]` already had the
right pattern — an embedded, working converter — applied to only two
low-traffic pages.

**Fix, shipped (`0b50e4b`, `de2084d`):**

- The existing `ConvertPageConverter` island embedded at the end of every
  guide and blog article (reusing the same anonymous quota, sign-in wall, and
  analytics already used on `/convert/*` — no new product surface).
- A compact one-line CTA inserted before the article's second `<h2>` (a
  section break, always present, never mid-sentence), linking down to the
  converter — because 95–99% of these sessions are a single page with little
  scroll depth, so a footer-only converter would still miss most readers.
  Implemented via a tested pure function (`splitBeforeNthH2`) that cuts the
  rendered article HTML without ever losing or duplicating content.

Both routes remain statically prerendered; no SEO or caching impact.

## Corrections made mid-session

Two things worth recording plainly, since they shaped how much to trust each
finding:

- The consent-gate diagnosis was overstated. The real data showed most
  visitors were already opting in; the shutdown bug and the vault
  instrumentation gap mattered more. Removing Usercentrics was still the
  right call (Peter's decision, independent of the diagnosis), but it wasn't
  the unlock it was first framed as.
- A hydration-warning scare during verification turned out to be a stale
  browser tab left open through repeated hot-reloads, not a real regression —
  confirmed by testing against a clean tab and a worktree checkout of the
  pre-change commit.

## What to watch next

1. **"Where conversions start"** (In-product dashboard) — do `/guides/*` and
   `/blog/*` now appear as real sources, next to `/` and `/app`?
2. **Bounce rate on the three highest-traffic articles** — the risk side of
   adding a converter to pages that currently rank well in search.
3. **"Free-tier ceiling hit"** — now that the event fires on the real path,
   does anyone actually hit the limit? At last count, only one signed-in user
   ever had, once. This is the number that would justify usage-based pricing;
   right now the evidence points to a traffic/routing problem rather than a
   monetization one.

Pricing work was deliberately not started this session — it depends on the
above settling first.
