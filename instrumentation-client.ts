// PostHog boots here, before hydration, for every visitor.
//
// Cookieless by design: `persistence: "memory"` writes nothing to the browser,
// so no consent banner is required. Two consequences the rest of the code has
// to live with:
//   1. The distinct id resets on every full page load, so signed-in users are
//      re-identified from components/auth-provider.tsx on mount. That identify
//      call is what keeps a person coherent — it is not optional.
//   2. Anonymous visitors look new on each page load, so marketing-site "unique
//      visitors" runs high. Anonymous *conversions* are counted accurately in
//      Supabase (anon_usage), which is the number we actually report on.
import posthog from "posthog-js"

const token = process.env.NEXT_PUBLIC_POSTHOG_TOKEN

/**
 * Local development does not report to production analytics.
 *
 * The `defaults: "2026-01-30"` bundle sets `internal_or_test_user_hostname`,
 * but that only tags the person with $internal_or_test_user — the events are
 * still ingested and still counted in visitor and conversion totals. Before
 * this guard, localhost was the second-largest "host" in the project with
 * ~1,400 events. Set NEXT_PUBLIC_POSTHOG_LOCAL=1 to opt a local run back in
 * when you need to verify new instrumentation end to end.
 */
const host = typeof window === "undefined" ? "" : window.location.hostname
const isLocal = host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost")
const allowLocal = process.env.NEXT_PUBLIC_POSTHOG_LOCAL === "1"

if (token && (!isLocal || allowLocal)) {
  posthog.init(token, {
    api_host: "/ingest", // first-party proxy, see rewrites in next.config.mjs
    ui_host: "https://eu.posthog.com",
    defaults: "2026-01-30", // capture_pageview: "history_change", drops localhost
    persistence: "memory",
    person_profiles: "identified_only",
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
  })
}
