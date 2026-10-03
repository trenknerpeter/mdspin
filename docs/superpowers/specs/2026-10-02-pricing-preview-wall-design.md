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

## As built (differs from the design above)

- **`gateForGuest` never forwards `markdown_text` unless it gated it.** The original whitelist copied it raw, so a `{success:false, markdown_text}` or non-string body would have leaked the full document. The single route now gates *every* guest object body, including errors, not only 2xx ones.
- **The IndexedDB stash (`lib/pending-conversion.ts`) reads and deletes in one `readwrite` transaction** and handles `onabort`. Without that, a quota abort hung `savePendingConversion`, and two overlapping callers could both get the file.
- **The resume effect in `use-converter.ts` uses a `takeStarted` ref instead of a `cancelled` flag.** With the flag, React StrictMode's double effect consumed the destructive take and then discarded it, so dev builds silently lost the file.
- **`AddToVaultPanel` no longer takes `onAuthRequired`.** `stashForSignIn` stashes the file and opens the wall itself, so the dialog opens once.
- **Guest `file_conversion_completed.word_count` uses `preview.total_words`**, so funnel analytics count the full document, not the preview.
- **Marketing copy sweep (not in the original plan).** `lib/convert-pages.ts` (SEO bodies + FAQ), `how-it-works`, `formats`, `overview`, the article converter/CTA bar and the ChatGPT guide had promised "no signup, copy/download". They now say "preview free with no signup; free account for the full document".
- **Coffee removal also uninstalled `stripe` and `@stripe/stripe-js`** and dropped the Stripe block from `.env.example`.
- **Extension, beyond the design:**
  - The worker refuses chat-page (`sender.tab`) conversions *before* calling the API when there's no valid token, so a guest preview isn't spent and thrown away. Users with an expired mirrored token get "Open MDSpin to sign in or refresh your session"; only the popup refreshes tokens.
  - The popup re-converts automatically after sign-in when a preview is showing.
  - "Sign in for more" keys off HTTP 429 / `remaining === 0`, not the message text.
  - The local anonymous usage counter is gone; quota comes only from `X-RateLimit-*` headers.

### Follow-up 2026-10-03 (Peter's review of the live preview)
- Guests get **one** free preview, not three (`ANON_LIFETIME_LIMIT = 1`; `metrics.quota_pressure` updated, recorded in `20261003000000_quota_pressure_guest_limit_1.sql`).
- In the guest preview state, **"Sign in free to get the full document" is the only call to action**. "Create new" stays visible but is disabled and greyed. The previews-remaining line, the "Sign in for 10…" link, the Knowledge Vault promo box, Download/Copy on the card and "Convert more files" are hidden for guests. Signed-in users keep all of them.

## Status: shipped 2026-10-02

- **Website** deployed to production from `main` (`3cd2f04..9471569`). That push also carried a separate session's commit `479c254` (guest IP counters pruned after 90 days, IPs hashed, privacy retention text fixed).
- **Database** (hosted `ixdsddfxkrkytiitfici`, via Supabase MCP):
  - `waitlist` gained `user_id` (FK → `auth.users`, on delete set null) and `interest` (default `'pro'`), recorded in `20261002000000_waitlist_pro_interest.sql`.
  - `metrics.quota_pressure` now uses 10, recorded in `20261002000001_quota_pressure_limit_10.sql`.
  - RLS on `waitlist` still has no policies; only the service role writes it.
- **Stripe:** the webhook endpoint was disabled in the Stripe dashboard. `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_ID` and `STRIPE_WEBHOOK_SECRET` were removed from Vercel. `/payment/*` and `/api/checkout` no longer exist.
- **Verified live on production (signed out):**
  - `/api/convert/batch` and `/api/convert` both returned a 1,254-character preview of a 16,149-character document, ending with the marker. The last paragraph was absent, `preview: {truncated: true, total_words: 2440}`, and only whitelisted keys came back.
  - `/pricing` shows Free + Pro with "Notify me".
  - Locally, the waitlist insert wrote `interest = 'pro'` (test row deleted), and the preview card, wall dialog and IndexedDB stash were verified in the browser with a stubbed fetch. Local real conversions fail because `.env.local`'s `BACKEND_API_KEY` is rejected by api.mdspin.app.
- **Tests:** 712 passing; `tsc --noEmit` clean apart from the 2 baseline `supabase/functions` errors. eslint is not installed in this repo.
- **Not yet verified:** a real end-to-end sign-in resume on production (convert signed out → Download → sign in → lands on `/app` with the full document). Peter will test it manually.
- **Extension:** committed locally in `mdspin-chrome-extension` (`683e537..da0bece`, manifest 0.3.4). It is not pushed, not tested in Chrome and not submitted to the Web Store; Peter will do all three later.
- **Baselines to judge this against (2026-10-02, admin excluded):**
  - 65 guest IPs (78% converted once and left)
  - 67 accounts (34 never converted)
  - 20/day cap hit once
  - WAU 2, MAU 16
  - 10 vault users
  - 9 waitlist rows, all from before this change
- **Watch:** the PostHog funnel `preview_shown` → `preview_gate_clicked` → `preview_resumed`, plus `pro_waitlist_joined` and new `waitlist` rows.
