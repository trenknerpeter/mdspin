/**
 * The one way to capture an analytics event from the browser.
 *
 * PostHog is initialised in `instrumentation-client.ts` before hydration, so
 * by the time any component runs the singleton is ready. These wrappers exist
 * to keep event names typed and to make sure a broken analytics call can never
 * take a user-facing interaction down with it.
 */
import posthog from "posthog-js"
import type { AnalyticsEvent } from "./events"

export function track(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
  try {
    posthog.capture(event, properties)
  } catch {
    // Analytics is never worth breaking a click over.
  }
}

export function trackException(error: unknown): void {
  try {
    posthog.captureException(error)
  } catch {
    /* see above */
  }
}

/**
 * Tie subsequent events to a signed-in person.
 *
 * Called from components/auth-provider.tsx on every mount where a user is
 * present, not just at sign-in. With cookieless (memory) persistence the
 * distinct id resets on each full page load, so re-identifying here is what
 * stops one person fragmenting into many.
 */
export function identify(userId: string, email?: string): void {
  try {
    posthog.identify(userId, email ? { email } : undefined)
  } catch {
    /* see above */
  }
}

/** Forget the signed-in person, so the next visitor on this browser is new. */
export function resetIdentity(): void {
  try {
    posthog.reset()
  } catch {
    /* see above */
  }
}

/** The current distinct id, for stitching a browser action to a server event. */
export function distinctId(): string | undefined {
  try {
    return posthog.get_distinct_id()
  } catch {
    return undefined
  }
}
