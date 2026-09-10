import posthog from "posthog-js"

/**
 * PostHog boots only after the visitor consents.
 *
 * Initialising it up front and relying on `opt_out_capturing_by_default` is not
 * enough: an opted-out PostHog still POSTs to /ingest/flags/ with a device id
 * and pulls down surveys and exception autocapture. Consent has to gate
 * `init()` itself, so nothing reaches PostHog before the visitor accepts.
 */
let started = false

/** Boot PostHog. Safe to call repeatedly; only the first call does anything. */
export function startPostHog(): void {
  if (started) return
  const token = process.env.NEXT_PUBLIC_POSTHOG_TOKEN
  if (!token) return

  started = true
  posthog.init(token, {
    api_host: "/ingest",
    ui_host: "https://eu.posthog.com",
    defaults: "2026-01-30",
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
  })
}

/**
 * Consent withdrawn. PostHog cannot be un-initialised within a page, so stop it
 * capturing and clear what it stored; switching persistence to memory drops the
 * cookies and localStorage entries it already wrote.
 */
export function stopPostHog(): void {
  if (!started) return
  posthog.opt_out_capturing()
  posthog.reset(true)
  posthog.set_config({ persistence: "memory" })
}

/** The current distinct id, or undefined while PostHog is unconsented and idle. */
export function postHogDistinctId(): string | undefined {
  return started ? posthog.get_distinct_id() : undefined
}

/** Capture an event only if the visitor consented to analytics. */
export function postHogCapture(event: string, properties?: Record<string, unknown>): void {
  if (started) posthog.capture(event, properties)
}

/** Report an exception only if the visitor consented to analytics. */
export function postHogCaptureException(error: unknown): void {
  if (started) posthog.captureException(error)
}
