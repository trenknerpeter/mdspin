<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into MDSpin. This includes client-side initialization via `instrumentation-client.ts`, a server-side PostHog client at `lib/posthog-server.ts`, a reverse proxy through Next.js rewrites, environment variable setup, and event tracking across 8 files covering all critical user journeys — file conversions, authentication, payments, and API key management.

| Event | Description | File |
|---|---|---|
| `file_conversion_started` | User clicks convert to start converting one or more files | `app/page.tsx` |
| `file_conversion_completed` | A file was successfully converted to Markdown (one per file) | `app/page.tsx` |
| `file_conversion_failed` | A file conversion failed (one per file failure) | `app/page.tsx` |
| `markdown_copied` | User copies Markdown output to clipboard | `app/page.tsx` |
| `markdown_downloaded` | User downloads a .md file | `app/page.tsx` |
| `sign_in_submitted` | User submits the sign-in form or initiates Google OAuth | `app/auth/sign-in/page.tsx` |
| `sign_up_submitted` | User submits the sign-up form or initiates Google OAuth | `app/auth/sign-up/page.tsx` |
| `buy_coffee_clicked` | User clicks the Buy Coffee button | `components/buy-coffee.tsx` |
| `api_key_generated` | User successfully generates a new API key | `app/api-keys/page.tsx` |
| `api_key_revoked` | User successfully revokes an API key | `app/api-keys/page.tsx` |
| `conversion_rate_limited` | Server: conversion request rejected by daily rate limit | `app/api/convert/route.ts` |
| `checkout_initiated` | Server: Stripe checkout session created | `app/api/checkout/route.ts` |
| `payment_completed` | Server: Stripe webhook confirms payment (coffee purchase) | `app/api/webhooks/stripe/route.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics dashboard](/dashboard/680030)
- [Daily file conversions](/insights/phnd6lcV) — line chart of conversions started, completed, and failed per day
- [Sign-up & sign-in funnel](/insights/UOM186vO) — conversion from sign-up → first conversion started → first conversion completed
- [Coffee purchase funnel](/insights/stoX1xqZ) — drop-off from buy coffee clicked → checkout initiated → payment completed
- [New sign-ups over time](/insights/6JLroz7T) — daily unique users submitting sign-up and sign-in forms
- [Rate-limited users (churn risk)](/insights/4WkDld1q) — users hitting daily limits, a signal for upgrade demand

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
