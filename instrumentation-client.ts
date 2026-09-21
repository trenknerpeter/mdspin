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

if (token) {
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
