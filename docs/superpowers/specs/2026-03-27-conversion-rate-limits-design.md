# Conversion Rate Limits

## Problem

MDSpin's `/api/convert` endpoint has no usage limits. Any visitor (authenticated or not) can make unlimited conversion requests. While traffic is currently low, this leaves the service vulnerable to abuse — accidental or intentional — that could exhaust backend resources or rack up costs.

## Goal

Add daily conversion limits as abuse protection. Generous enough that real users are never blocked, strict enough that automated abuse is stopped. No payment integration — limits only.

## Tiers

| Tier | Daily Limit | Identifier |
|------|-------------|------------|
| Anonymous | 3 conversions | IP address (from request headers) |
| Signed-in | 20 conversions | Supabase user ID |

Limits reset at midnight UTC.

**Note on cross-tier usage**: A signed-in user's conversions are tracked by user ID, not IP. If they sign out, they get 3 additional anonymous conversions from the same IP. Similarly, anonymous users who sign in get a fresh 20. This is acceptable for abuse prevention at this scale and avoids over-engineering the identifier mapping.

## Data Model

New Supabase table: `daily_usage`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `bigint` (auto) | Primary key |
| `identifier` | `text` | User ID or IP address |
| `identifier_type` | `text` | `'user'` or `'ip'` |
| `date` | `date` | Calendar day (UTC) |
| `conversion_count` | `integer` | Default 0 |
| `created_at` | `timestamptz` | Default `now()` |
| `updated_at` | `timestamptz` | Default `now()` |

**Unique constraint**: `(identifier, identifier_type, date)`

**Increment strategy**: Atomic upsert — `INSERT ... ON CONFLICT DO UPDATE SET conversion_count = conversion_count + 1`. No race conditions. Count is incremented **after** a successful backend conversion, so failed conversions don't consume credits.

**RLS policy**: RLS enabled, no public policies. All access is via the service role client (which bypasses RLS).

**Data retention**: Rows older than 90 days can be cleaned up. Add a Supabase pg_cron job or address manually when the table grows. Not part of initial implementation.

### SQL Migration

```sql
CREATE TABLE daily_usage (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  identifier text NOT NULL,
  identifier_type text NOT NULL CHECK (identifier_type IN ('user', 'ip')),
  date date NOT NULL DEFAULT CURRENT_DATE,
  conversion_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_daily_usage_identifier_date
  ON daily_usage (identifier, identifier_type, date);

ALTER TABLE daily_usage ENABLE ROW LEVEL SECURITY;
-- No public RLS policies. Access exclusively via service role client.
```

## Supabase Admin Client

**New file**: `lib/supabase/admin.ts`

Creates a Supabase client using `SUPABASE_SERVICE_ROLE_KEY` (server-only). This bypasses RLS and is used exclusively by `lib/rate-limit.ts` for reading/writing `daily_usage`.

The `SUPABASE_SERVICE_ROLE_KEY` env var already exists in the project (used in `app/auth/callback/route.ts`). It must also be set in Vercel environment variables if not already.

```typescript
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

## API Changes

**File**: `app/api/convert/route.ts`

Full request flow after changes:

1. Validate server config (existing)
2. **Rate limit check** (NEW):
   a. Get user session via `createClient()` from `lib/supabase/server.ts`
   b. Extract IP: `req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()`
   c. Determine identifier: signed-in → `(user.id, 'user')`, anonymous → `(ip, 'ip')`
   d. Call `checkRateLimit(identifier, identifierType)` from `lib/rate-limit.ts`
   e. If not allowed → return 429 with rate limit headers
3. Parse incoming FormData (existing)
4. Validate file type (existing)
5. Convert File → base64 (existing)
6. Call the backend (existing)
7. **Increment usage** (NEW) — only after successful backend response (2xx)
8. Forward response with `X-RateLimit-Remaining` and `X-RateLimit-Limit` headers

**429 response shape**:
```json
{
  "error": "RATE_LIMITED",
  "message": "Daily conversion limit reached. Sign in for more conversions.",
  "limit": 3,
  "remaining": 0,
  "resetsAt": "2026-03-28T00:00:00Z"
}
```
For signed-in users: `"Daily limit of 20 conversions reached. Resets at midnight UTC."`

**IP extraction note**: On Vercel, `x-real-ip` is set by the edge and cannot be spoofed by clients. We prefer it over `x-forwarded-for` which can contain multiple IPs. Fallback to `x-forwarded-for` first entry if `x-real-ip` is absent.

## Rate Limit Utility

**New file**: `lib/rate-limit.ts`

Exported functions:
- `checkRateLimit(identifier, identifierType)` → `{ allowed: boolean, remaining: number, limit: number, resetsAt: string }`
- `incrementUsage(identifier, identifierType)` → void

Both use the admin client from `lib/supabase/admin.ts`. Constants for limits (3 / 20) defined here.

## Frontend Changes

**File**: `app/page.tsx`

### State additions
- `rateLimited: boolean` — whether the user has hit their limit
- `remaining: number | null` — conversions remaining today (from response headers)
- `dailyLimit: number | null` — the user's total daily limit

### Behavior changes
- After each conversion response (success or 429), read `X-RateLimit-Remaining` and `X-RateLimit-Limit` headers and update state
- On 429 response, set `rateLimited = true` and parse the response body for the message
- On successful sign-in (page reload), state resets — remaining count is unknown until next conversion attempt. UI handles the "unknown" state gracefully (no counter shown until first response).

### UI changes

**When rate limited (anonymous)**:
Replace the Spin button area with:
> "You've used your 3 free conversions today. Sign in for up to 20 daily conversions."
> [Sign in with Google button]

**When rate limited (signed-in)**:
Replace the Spin button area with:
> "You've reached your daily limit of 20 conversions. Your limit resets at midnight UTC."

**Remaining counter**:
Below the Spin button, show subtle text like "17 of 20 conversions remaining today" — only displayed after the first successful conversion (when `remaining` is not null).

### Relationship to existing `conversions` table insert

The existing client-side insert into `conversions` (line 135 of `page.tsx`) is independent from `daily_usage`. The `conversions` table is for user history display; `daily_usage` is for rate limiting. They are tracked separately — `conversions` is fire-and-forget from the client, `daily_usage` is server-authoritative.

## What We're NOT Building

- No payment integration (Stripe, LemonSqueezy, Buy Me a Coffee)
- No admin dashboard for managing limits
- No per-file-type or file-size limits
- No weekly/monthly aggregate limits
- No "upgrade" or "unlock" path
- No client-side pre-check endpoint (limits checked inline during conversion)
- No unit tests (manual verification for now; tests can be added later)

## Files to Create/Modify

| File | Action |
|------|--------|
| `lib/supabase/admin.ts` | **Create** — Supabase service role client |
| `lib/rate-limit.ts` | **Create** — rate limit check and increment logic |
| `app/api/convert/route.ts` | **Modify** — add rate limit check before conversion, increment after success |
| `app/page.tsx` | **Modify** — handle 429 responses, show limit messaging, remaining counter |
| Supabase SQL editor | **Manual** — run migration SQL above to create `daily_usage` table |

## Verification

1. **Anonymous limit**: Open incognito, convert 3 files → 4th should return 429 with sign-in CTA
2. **Signed-in limit**: Sign in, convert files → verify remaining counter decrements → at 20 should show limit message
3. **Reset**: Verify that counts are per-day (change date in DB row to yesterday, confirm new conversions work)
4. **Failed conversions**: Upload an unsupported file type → verify it doesn't consume a credit
5. **IP extraction**: Check `x-real-ip` / `x-forwarded-for` parsing works correctly on Vercel
6. **Race condition**: Rapid concurrent requests → verify atomic upsert prevents over-counting
7. **Cross-tier**: Anonymous user hits limit → signs in → gets fresh 20 conversions
