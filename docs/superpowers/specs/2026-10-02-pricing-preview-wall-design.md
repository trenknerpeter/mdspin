# Pricing & limits rework: preview wall, 10/day free, Pro waitlist

## Context

Today: guests get 3 full conversions for life, signed-in users 20/day, and the only paid thing is a $2.99 "Buy me a coffee" that nobody uses. Live data (2026-10-02, admin excluded) shows the limits do no work:

- 65 guest IPs → 51 (78%) converted once and left; only 6 ever reached 3.
- 67 accounts → 34 never converted; the 20/day cap was hit once by one person; 30 of 35 users never did more than 4 in a day.
- Vault: 10 users ever saved, 4 made a project, 0 used subprojects/map/MCP/GitHub sync.
- WAU 2, MAU 16.

**Goal Peter chose:** capture emails and repeat users, not revenue. **Decisions made:**
1. Guests convert one file and see a **preview**; copy / download / save / full view need sign-in.
2. Signed-in Free = **10 conversions/day**, vault included.
3. Replace Coffee with **Free + "Pro — coming soon" waitlist** promising *higher limits & bigger files* and *AI vault features* (both stay free today; the card measures demand).
4. The **Chrome extension** follows the same rules for signed-out users.

## Design

### 1. Server-side preview (the real gate)
The full markdown currently reaches the browser for everyone, so the cut must happen on the server.
- New pure module `lib/preview.ts`: `buildPreview(markdown) → { preview, truncated, totalWords }`. Cuts at a paragraph boundary near ~1,200 chars; if the doc is shorter than that, it still cuts at ~40% so there is always something behind the wall. Appends a visible marker line (`> Preview only. Sign in free at mdspin.app to get the full document.`). The marker matters for **already-installed extensions**, which would otherwise silently paste a truncated document into ChatGPT.
- Apply it to anonymous responses in `app/api/convert/batch/route.ts` (website) and `app/api/convert/route.ts` (extension/API). Add `preview: { truncated, total_words }` to each result so new clients can render the wall. Signed-in responses are unchanged.
- Guest previews still count against `anon_usage` (lifetime 3, `ANON_LIFETIME_LIMIT` unchanged). This keeps backend cost bounded; after 3 previews the modal asks them to sign in.
- URL mode and multi-file stay sign-in-only (`lib/gating.ts`, unchanged).

### 2. Website converter UI
- `components/converter/use-converter.ts`: store `preview` metadata per file. For guests, Copy / Download / Add to Vault / merged view open the sign-in modal. Fire PostHog events `preview_shown` and `preview_gate_clicked {action}` via the existing `EVENTS` map.
- `components/converter/converter.tsx`: render the preview with a fade-out plus an inline "Sign in free to get the full document (N words)" bar. Remove the Coffee button. Change "Sign in for up to 20 daily conversions" to 10.
- **Resume after sign-in, without storing strangers' documents server-side:** before opening the modal, stash the original `File` blob(s) in IndexedDB (new helper next to the existing `mdspin:pendingVaultAdd` stash, same 1-hour TTL). After sign-in lands on `/app`, the existing resume effect re-runs the conversion as the signed-in user (it counts 1 toward their 10), then finishes the action they clicked. Fire `preview_resumed`. Falls back to "please re-upload" if the blob is missing or too large.
- Extract the duplicated sign-in `Dialog` (in `components/marketing/home-page-client.tsx` and `convert-page-converter.tsx`) into one `components/converter/sign-in-gate-dialog.tsx` with the new copy.

### 3. Limits
- `lib/usage-math.ts`: `AUTH_DAILY_LIMIT = 10`. Per-request batch cap 20 → 10 (`converter-intake` plus "up to 20 files" copy in `how-it-works`, `converter.tsx` and `developer-api/api-docs-data.ts`), so one batch can't exceed a day's quota.
- `metrics.quota_pressure` view: change hardcoded 20 → 10 via Supabase MCP; record it in a new `supabase/migrations/2026100X_free_limit_10.sql` (record-only).

### 4. Pricing page & waitlist
- `app/pricing/page.tsx`: two cards. **Free**: 1 guest preview → sign in; 10/day; full vault. **Pro, coming soon**: higher daily limits & bigger files, unlimited AI summaries/briefs/auto-filing; a "Notify me" button (one click if signed in, an email field if not). Rewrite the FAQ (drop Coffee, fix the stale "guests 3 per day" text).
- `app/api/waitlist/route.ts`: switch to the service-role client (the table has RLS on and no policies, so public inserts fail today). Record `user_id` when signed in, plus `interest`.
- DB: `alter table waitlist add column user_id uuid null, add column interest text not null default 'pro'`. Applied via MCP, migration file recorded.
- Remove Coffee everywhere: `components/buy-coffee.tsx`, `app/api/checkout`, `app/payment/*`, `app/api/webhooks/stripe`, and the `buyCoffeeClicked`/`checkoutInitiated` events. Leave the Stripe env vars in Vercel alone. All of this is recoverable from git.
- `app/privacy/page.tsx`: correct the guest wording (lifetime previews, not "per day"), and state that guests get a preview and the full result needs an account.

### 5. Chrome extension (`../mdspin-chrome-extension`, separate release)
- `src/popup/Popup.tsx`: drop the hardcoded `ANON_LIMIT/AUTH_LIMIT` and read the limit from `X-RateLimit-*` headers. When `preview.truncated`, show the preview plus a "Sign in to get the full document" button using the existing extension sign-in. Copy/download/inject are disabled for previews.
- `src/background/worker.ts`: pass the `preview` field through. Do not inject preview text into ChatGPT/Gemini.
- Ship order: website first (old extensions degrade safely via the marker line), then the extension build and a Chrome Web Store submission, which Peter does himself.

### Not in scope
Stripe Pro billing, gating AI features, monthly quotas, emailing results.

## After approval (before code)
Copy this design into `docs/superpowers/specs/2026-10-02-pricing-preview-wall-design.md`, commit it to main, then write the implementation plan (writing-plans) and implement test-first.

## Verification
- **Unit (Vitest, `npm test`):** new `lib/__tests__/preview.test.ts` (short/long docs, paragraph cut, marker present, never returns the full text when truncated); update `usage-math.test.ts` (10) and `converter-intake.test.ts` (10 files).
- **Route check:** `npm run dev`, then `curl -F file=@sample.pdf localhost:3000/api/convert` without auth. The response must contain the preview and marker but **not** the document's last paragraph. With a Bearer key it returns the full text.
- **Browser (preview tools):** in a signed-out tab, convert a file → see the preview and wall → click Download → modal → sign in with a local test account → lands on `/app` with the file re-converted and the download available. Check the console and the PostHog events in network requests. Pricing page shows 2 cards, and "Notify me" writes a waitlist row (check via SQL).
- **DB:** `select * from metrics.quota_pressure` uses 10; the waitlist insert works from the server.
- **Extension:** load unpacked, convert while signed out → preview + sign-in button, nothing injected.
