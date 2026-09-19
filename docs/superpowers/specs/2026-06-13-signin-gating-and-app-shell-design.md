# Sign-in Gating + `/app` SaaS Shell — Design Spec

**Date:** 2026-06-13
**Repo:** `true_frontend` (MDSpin frontend — thin proxy over `mdc-api`)
**Status:** Approved design, ready for implementation planning

---

## 1. Goal & Strategy

Grow a signed-in user base by converting anonymous visitors at their moment of
highest intent, and reward signing in with a real product experience.

The product becomes three layers:

1. **Public marketing site** (unchanged top-nav) — including a **teaser converter**
   on the homepage that lets anonymous users taste the core, then walls them.
2. **A hard wall** at the point an anonymous user clearly finds the tool useful
   ("generous-then-wall"), plus capability gates on power features.
3. **A signed-in app at `/app`** — a left-sidebar SaaS shell with the converter,
   history, API keys, and conversion presets.

This is a **frontend-first** spec. Backend (`mdc-api`) work needed to fully
deliver the presets feature is documented in §7 but is **out of scope for this
repo's implementation** — it is captured so it can be sequenced separately.

---

## 2. Gating Model

| Audience | Single-file upload | URL conversion | Batch (2+ files) | API | Volume limit |
|---|---|---|---|---|---|
| **Anonymous** | ✅ allowed | 🔒 sign-in required | 🔒 sign-in required | 🔒 | **3 lifetime** (not per-day) |
| **Signed-in (free)** | ✅ | ✅ | ✅ | ✅ | **20 / day** (unchanged) |
| **Pro** | — | — | — | — | *Out of scope* |

### 2.1 Anonymous volume wall — "3 lifetime"

- Replaces today's "3 per day, resets at UTC midnight" for anonymous (IP) users.
- Tracking is **best-effort** and intentionally imperfect (the user accepted this):
  - **Primary:** a non-resetting server-side counter keyed by client IP.
  - **Secondary:** a device marker in `localStorage` as a first-line client check
    (lets the UI show the wall instantly without a round-trip, and slightly raises
    the bar against trivial IP churn).
- When the lifetime count is exhausted, the converter shows a **wall interstitial**
  (see §4.3) instead of converting.
- **Signed-in users are unaffected** — they keep the existing 20/day daily-reset
  behavior in `daily_usage`.

### 2.2 Capability gates (sign-in required from use #1)

Anonymous users see these capabilities (to tease them) but are prompted to sign in
the moment they try to use them:

- **URL / web-page conversion** (`/api/convert/url`)
- **Batch / multi-file** (`/api/convert/batch` with **more than one** file)
- **API access** (`/api/api-keys`, already auth-guarded)

Single-file upload (exactly one file, any supported format **including PDF**) stays
open to anonymous users within the 3-lifetime allowance. PDF is deliberately **not**
gated — the user flagged that as too risky.

---

## 3. Affected Surfaces — Current State

- **Converter UI** lives inside the 58 KB `app/page.tsx` monolith. It posts to
  `/api/convert/batch` (files, 1–20) and `/api/convert/url` (single URL).
- **Rate limiting** is entirely frontend-side: `lib/rate-limit.ts` →
  `daily_usage` table + `increment_daily_usage` RPC. Anon = 3/day, auth = 20/day,
  both reset at UTC midnight.
- **`app/api/convert/batch/route.ts`** identifies the caller as `user.id` or client
  IP, rate-checks, then proxies to `${BACKEND_URL}/v1/convert/attachments/batch`.
  It currently sends **no conversion options** — only `{ files: [...] }`.
- **`app/api/convert/url/route.ts`** proxies `{ url }` to `/v1/convert/url`.
- **Existing app-ish pages** (`app/history`, `app/api-keys`) are auth-guarded but use
  a simple back-button layout — **no shared shell**. `components/ui/sidebar.tsx`
  exists but is **unused**.
- **`components/site-nav.tsx`** is the marketing top-nav; signed-in users get an
  avatar dropdown linking to `/history` and `/api-keys`.

---

## 4. Frontend Scope (this repo)

### 4.1 Converter extraction (refactor — prerequisite)

The converter is currently embedded in `app/page.tsx`. Extract it into a reusable
component (e.g. `components/converter/`) so it can be mounted in **two** contexts:

- **Homepage teaser** (public, anon-gated) — single-file only; URL/batch tabs
  visible but trigger the sign-in prompt; enforces the 3-lifetime wall.
- **`/app` Convert page** (signed-in) — all modes enabled, preset picker present.

The component takes a `mode` / `context` prop (`"teaser" | "app"`) to toggle gated
behavior, rather than duplicating logic. Keep the extraction focused — do not
redesign the converter's look, only relocate and parameterize it.

### 4.2 `/app` shell

- New authenticated route group (e.g. `app/(app)/` rendering at `/app/*`) with a
  `layout.tsx` that renders a **persistent left sidebar** built on the existing
  `components/ui/sidebar.tsx`.
- **Auth guard:** unauthenticated hits to `/app/*` redirect to `/auth/sign-in?next=…`.
  Enforce in `middleware.ts` (preferred — already exists) and/or the layout.
- **Sidebar nav:**
  - **Convert** → `/app` (index) — the extracted converter, all modes.
  - **My Spins** → `/app/spins` — rehomed history (see §4.4).
  - **API Keys** → `/app/api-keys` — rehomed existing page.
  - **Settings** → `/app/settings` — conversion presets (see §4.5).
- **Sidebar header:** logo + a small **usage indicator** ("12 / 20 today"), read
  from the same rate-limit data the API returns (`X-RateLimit-*` headers / a small
  usage read).
- **Sign-in redirect target:** after successful sign-in/sign-up, redirect into
  `/app` (honoring `?next=` when present).
- Old routes `/history` and `/api-keys` **redirect** to their `/app/*` equivalents
  (preserve any inbound links / muscle memory).

### 4.3 Anonymous wall + capability prompts (homepage teaser)

- **Wall interstitial:** when an anon user has used all 3 lifetime conversions,
  replace the convert action with a focused panel: headline ("You've used your 3
  free spins"), value bullets (history, 20/day, URL & batch, presets), and
  **Sign up / Sign in** CTAs. Triggered both client-side (localStorage) and on the
  server's `RATE_LIMITED` response.
- **Capability prompt:** clicking the URL or batch tab/action as an anon user opens
  a sign-in prompt ("Convert from a URL — free with an account") rather than
  performing the conversion.
- Reuse the existing auth-aware messaging hook already present in `app/page.tsx`.

### 4.4 My Spins (rehomed history)

- Move history into `/app/spins` within the shell.
- **Uncap** the current 50-row limit — paginate or lazy-load instead.
- Keep existing per-row actions (copy / download / delete). *(Re-spin, bulk export,
  folders/tags were considered and deferred — not in v1.)*

### 4.5 Settings → Conversion presets ("Spin profiles") — marquee feature

- New `/app/settings` page with a **Conversion** section.
- Users configure output options and save them as **named presets**, with one
  marked default. Candidate options (final set gated by backend support — see §7):
  - Front-matter: on / off (and which fields)
  - Image handling: inline / link / strip
  - Heading style / normalization
  - Table handling
- **Persistence:** a new Supabase table `conversion_presets`
  (`id`, `user_id`, `name`, `options jsonb`, `is_default bool`, `created_at`).
  Frontend owns this (same Supabase project as `daily_usage`).
- **Converter integration:** the `/app` Convert page shows a **preset picker**; the
  selected preset's `options` object is sent with the conversion request (new
  `options` field in the POST body to `/api/convert/batch` and `/api/convert/url`).
- **Graceful degradation:** until `mdc-api` honors `options` (§7), the UI ships
  behind a flag OR only exposes the subset of options the backend already supports.
  The presets *persist and send* regardless; their **effect** depends on the backend.

### 4.6 API route changes

- **`/api/convert/url`** — if `!user`, return `401 AUTH_REQUIRED` with a message the
  UI maps to the sign-in prompt. (Capability gate.)
- **`/api/convert/batch`** — if `!user` **and** `files.length > 1`, return
  `401 AUTH_REQUIRED`. (Batch gate.) Single-file anon requests continue.
- **`lib/rate-limit.ts`** — split anon from auth:
  - Auth (`user`): unchanged 20/day against `daily_usage`.
  - Anon (`ip`): check/increment a **lifetime** counter (no date key) — either a new
    `anon_usage` table (`identifier`, `count`) + RPC, or a lifetime variant of the
    existing helpers. Limit = 3, no reset.
- Both routes accept an optional **`options`** field and forward it to the backend
  (no-op until backend honors it).
- Preserve the existing fail-open behavior (don't block users if the DB check errors).

### 4.7 Navigation updates

- `components/site-nav.tsx`: signed-in avatar dropdown points to `/app` ("Open app"),
  `/app/spins`, `/app/api-keys`. The public "Try it" CTA still targets the homepage
  converter.

### 4.8 Out of scope (explicitly deferred)

- Pro / paid tier and any billing changes.
- Usage charts/analytics page beyond the simple sidebar indicator.
- Spin library extras: re-spin, folders/tags, bulk zip export.
- Make.com / webhook integrations from the app.
- Team / multi-user workspaces.

---

## 5. Data Model Changes (Supabase, owned by frontend)

1. **`conversion_presets`** (new): `id uuid pk`, `user_id uuid fk`, `name text`,
   `options jsonb`, `is_default bool default false`, `created_at timestamptz`.
   RLS: owner-only read/write.
2. **Anonymous lifetime usage** (new or variant): a non-resetting counter keyed by
   IP identifier. New `anon_usage` table (`identifier text pk`, `count int`,
   `updated_at`) + an `increment_anon_usage` RPC, or extend rate-limit helpers.
3. **`daily_usage`**: unchanged (signed-in 20/day continues to use it).

---

## 6. Error Handling & Edge Cases

- **Fail-open** on rate-limit DB errors (matches current behavior) — never block a
  conversion because the counter read failed.
- **Anon tracking is defeatable** (clearing storage, IP rotation) — accepted; the
  goal is gentle nudging, not DRM.
- **Mixed batch by anon** (1 valid + extras) → treated as batch → `401 AUTH_REQUIRED`.
- **Signed-in over daily limit** → existing 429 with reset-at-midnight messaging.
- **`/app` accessed while signed out** → redirect to sign-in with `?next=`.
- **Preset sends options the backend ignores** → conversion still succeeds; output
  simply reflects backend defaults (no error surfaced).

---

## 7. Backend Requirements — `mdc-api` (separate repo, documented not built here)

> The conversion-presets feature is only *fully* realized once the backend accepts
> and honors conversion options. Until then the frontend persists and transmits
> options as a no-op. Sequence backend work **before** turning presets on for users.

**B1. Conversion options contract.** Both conversion endpoints must accept an
optional `options` object and honor it:

- `POST /v1/convert/attachments/batch` — body gains `options` alongside `files`.
- `POST /v1/convert/url` — body gains `options` alongside `url`.

**B2. Options schema** (proposed; finalize on the backend side). Define and document
each field's accepted values and default, e.g.:

- `frontmatter`: `"none" | "basic" | "full"` (default `"none"`)
- `images`: `"inline" | "link" | "strip"` (default current behavior)
- `headings`: normalization strategy
- `tables`: handling strategy

**B3. Backward compatibility.** Omitting `options` must preserve today's exact
output (no behavior change for existing callers, including the API-key API).

**B4. Validation & echo.** Backend validates unknown/invalid option values
gracefully (ignore or 400 with a clear message) and ideally echoes the effective
options used, so the frontend can confirm what was applied.

**B5. (No backend change needed for)** anonymous lifetime tracking or preset
storage — both live in the frontend's Supabase project.

---

## 8. Suggested Implementation Sequence (frontend)

1. **Gating logic** — rate-limit split (anon lifetime vs auth daily), API route
   capability gates (URL, batch). Lowest-risk, high-leverage, no UI dependency.
2. **Converter extraction** — pull the converter out of `app/page.tsx` into a
   parameterized component; wire homepage teaser to the new gating + wall.
3. **`/app` shell** — route group, sidebar, auth guard, rehome My Spins + API Keys,
   redirects from old paths, sign-in redirect into `/app`.
4. **Presets** — `conversion_presets` table, Settings UI, preset picker, send
   `options` (no-op until backend). Ship behind a flag if backend isn't ready.

---

## 9. Success Criteria

- Anonymous users can convert a single file up to 3 times (lifetime), then hit a
  clear wall with sign-in/sign-up CTAs.
- Anonymous attempts at URL or multi-file conversion produce a sign-in prompt, not a
  conversion.
- Signed-in users land in `/app`, see a left-sidebar shell, and retain 20/day.
- My Spins and API Keys are reachable inside the shell; old URLs redirect.
- Users can create/edit/delete named conversion presets that persist and are sent
  with conversion requests (effect contingent on backend §7).
- No regression to signed-in daily limits or existing conversion behavior.
