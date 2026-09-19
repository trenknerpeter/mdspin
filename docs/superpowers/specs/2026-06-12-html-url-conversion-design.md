# MDSpin — Format Expansion: HTML files + URL/web-page conversion

**Status:** Approved design · **Date:** 2026-06-12

## Context

MDSpin converts documents to clean, AI-ready Markdown. We want to **deepen the product** by
expanding the input formats it accepts. The chosen first step is **HTML files + URL (web page)
conversion** — the highest-value input for RAG/knowledge-base ingestion, and by far the cheapest
to ship because most of the machinery already exists:

- The backend (`mdc-api`) already has a working `htmlToMarkdown()` (Turndown-based, used today for
  the DOCX→HTML→MD pipeline) — it just isn't wired to accept `.html` input.
- The backend already exposes `POST /v1/convert/url` (used by the Make app's `convertFromUrl`),
  which fetches a URL, size-checks it, and derives a filename — but it routes through the same
  7-format gate, so it can't yet handle an actual web page.
- The website has **no URL-conversion UI at all** today, even though the Make app does. Adding one
  is a meaningful product surface in its own right.

A framing note that shaped this scope: **Markdown is the LLM-preferred *output*; HTML/PDF/etc. are
the noisy *inputs* you convert from.** This spec expands input coverage and leaves the Markdown
output untouched.

Two correctness issues also motivate the work: the `/formats` marketing page **already advertises
HTML and CSV**, but the converter rejects both — a promise the product doesn't keep.

This work spans **two repos**:
- Backend: `/Users/p.trenkner/Documents/Master/MDC_project/mdc-api`
- Frontend: `/Users/p.trenkner/Documents/Master/MDC_project/true_frontend`

**Out of scope (deliberate):** CSV + Excel (XLSX) and any output-format changes (e.g. YAML front
matter). Both are recorded as follow-ups below. This spec keeps strictly to HTML + URL input.

---

## Backend changes (`mdc-api`)

### 1. Accept `.html` / `.htm` as a real input format
**File:** `src/lib/convertFileToMarkdown.js`

- Add detection alongside the existing flags (lines 154–171):
  ```js
  const isHtml = ext === 'html' || ext === 'htm';
  ```
  Add `&& !isHtml` to the unsupported-type guard, and add `HTML (.html, .htm)` to the `hint` string.
- Add a conversion branch (in the `try` block, lines 177–215), reusing the **existing**
  `htmlToMarkdown` import (line 13) and `addStructureAnnotations`:
  ```js
  } else if (isHtml) {
    markdownText = addStructureAnnotations(htmlToMarkdown(fileBuffer.toString('utf-8')));
  }
  ```
  No new dependency — `turndown` is already installed and `htmlToMarkdown()` already handles
  `<head>/<style>/<script>` stripping and table preservation.

### 2. Route extension-less web-page URLs to the HTML branch
**File:** `src/routes/convertUrl.js`

- Extend the `mimeToExt` map (lines 130–138) so `Content-Type: text/html` resolves to `html`:
  ```js
  'text/html':             'html',
  'application/xhtml+xml': 'html',
  ```
- Handle the common case of a web-page URL with **no filename and no extension** (e.g.
  `https://example.com/docs`). Today that path falls through to `MISSING_FILENAME` (lines 114–119).
  Before that guard, if the fetched `Content-Type` is HTML, default the filename
  (e.g. `parsedUrl.hostname` or `page`) so the `.html` extension can be appended and conversion
  proceeds. Keep `MISSING_FILENAME` only for the genuinely-undeterminable non-HTML case.

> The existing 30s fetch timeout, 20 MB size guard, and structured error mapping already cover the
> URL path — no change needed there.

---

## Frontend changes (`true_frontend`)

### 3. Centralize the supported-format list (targeted DRY fix)
The extension list is currently duplicated in **4+ places**, which is exactly why HTML/CSV drifted
out of sync. Since we're touching all of them, introduce one shared source of truth:

- **New file:** `lib/formats.ts` exporting `SUPPORTED_EXTS` (lowercase array) and
  `SUPPORTED_FORMATS` (uppercase display array), plus the `MIME_TYPES` map currently inline in
  `app/api/convert/route.ts`.
- Replace the local copies in:
  - `app/page.tsx:31` (`SUPPORTED_FORMATS` display) and `:69` (`SUPPORTED_EXTS` validation)
  - `app/page.tsx:576` (`accept=".pdf,..."` attribute — derive from the shared list)
  - `app/api/convert/route.ts:104` + the `MIME_TYPES` map (lines ~127–136)
  - `app/api/convert/batch/route.ts:25`
- Add `html` and `htm` to the shared lists; add `text/html` to `MIME_TYPES`.

### 4. New URL-conversion proxy route
**New file:** `app/api/convert/url/route.ts` — mirror the existing
`app/api/convert/batch/route.ts` pattern exactly:
- `runtime = 'nodejs'`; validate `BACKEND_URL`/`BACKEND_API_KEY`.
- Rate-limit check via `checkRateLimit` (reuse `@/lib/rate-limit`), same user-vs-IP identifier logic.
- Accept JSON `{ url, filename? }`, forward as `{ file_url, filename }` to
  `${BACKEND_URL}/v1/convert/url`.
- On `backendRes.ok`, `incrementUsage(...)` once (fire-and-forget) and return
  `X-RateLimit-*` headers — identical accounting to the batch route.

### 5. "Paste a URL" UI on the homepage
**File:** `app/page.tsx`
- Add a small toggle/tab above the dropzone: **Upload files** | **From URL**. The URL mode shows a
  text input + Convert button.
- On submit: POST to `/api/convert/url`, then reuse the **existing** result-rendering, copy/download,
  Supabase history-save, and rate-limit-banner code paths (the result shape matches
  `convertFileToMarkdown`'s output). Validate the URL client-side (http/https) before sending.
- Reuse the existing rate-limited / error UI states.

### 6. Fix the `/formats` marketing mismatch
**File:** `app/formats/page.tsx`
- HTML is now genuinely supported — keep/adjust its card and add a "paste a URL" mention.
- CSV is **not** shipping in this spec — either remove its card or mark it clearly as upcoming so the
  page no longer over-promises. (Recommend: mark as "Coming soon" until the CSV/Excel follow-up.)

### 7. Analytics
**Files:** `app/page.tsx` (client capture), keep `lib/posthog-server.ts` patterns.
- Add a `source: 'upload' | 'url'` property to `file_conversion_started` / `file_conversion_completed`
  / `file_conversion_failed` so we can measure URL-conversion adoption separately.

---

## Verification (end-to-end)

**Backend (run locally first):**
1. `cd mdc-api && npm run dev` (or the repo's start script).
2. `.html` file path — `curl` `POST /v1/convert/attachment` with a base64 HTML file + auth header;
   confirm clean Markdown + `file_type: "html"`.
3. URL path — `POST /v1/convert/url` with `{ "file_url": "https://example.com" }` (extension-less
   web page); confirm it resolves to HTML and returns Markdown rather than `MISSING_FILENAME` or
   `UNSUPPORTED_FILE_TYPE`. Also test a direct `.pdf` URL to confirm no regression.
4. There are no tests in this repo today; at minimum add a quick assertion script (or a first
   `convertFileToMarkdown` test) covering the HTML branch.

**Frontend (preview tools):**
5. Point `BACKEND_URL` at the local backend (or deploy backend first), run the dev server.
6. Use the preview workflow: open the app, switch to **From URL**, paste a public web page, Convert —
   confirm Markdown renders, copy/download work, and (signed in) the row appears in `/history`.
7. Upload a `.html` file via the dropzone — confirm it's accepted (was previously rejected) and
   converts.
8. Check `preview_console_logs` / `preview_network` for errors; confirm `X-RateLimit-*` headers and
   that a rate-limited state renders correctly.
9. Confirm the `/formats` page no longer advertises an unsupported format.

> Note: full end-to-end requires the **backend deploy to `api.mdspin.app`** before the production
> frontend works. Sequence: ship + deploy backend → then ship frontend.

---

## Follow-up (not this spec)
- **CSV + Excel (XLSX)** → Markdown tables: new backend parsers (SheetJS/papaparse), multi-sheet
  handling, then the same frontend list + UI updates. Its own spec.
- **YAML front matter (output-side):** optional `---`-delimited metadata block prepended to the
  output Markdown (`title`/`source`/`format`/`word_count`/`converted_at`). The backend already
  computes all of these — near-trivial — and it's highly RAG/knowledge-base aligned. Strong
  candidate for the next increment after this one.
