import { PostHog } from "posthog-node"
import { after } from "next/server"
import type { AnalyticsEvent } from "@/lib/analytics/events"

/**
 * Server-side analytics.
 *
 * Complements the browser SDK rather than duplicating it: these events survive
 * ad blockers, and they cover surfaces that have no browser at all (the REST
 * API, the MCP server, GitHub webhooks, Stripe webhooks).
 *
 * Past bug worth not reintroducing: callers used to `await posthog.shutdown()`
 * after each capture. Because the client is a module-level singleton, the first
 * event on a warm serverless instance killed the client and every later event
 * from that instance was silently discarded. Flush, never shut down.
 *
 * Deliberately NOT marked "server-only", for the same reason as lib/mcp/context.ts:
 * lib/mcp/writeGuards.ts imports this, and writeGuards is unit-tested under plain
 * `vitest run`, where the "server-only" module cannot resolve. It is only ever
 * reached through server import graphs anyway.
 */

let posthogClient: PostHog | null = null

function getPostHogClient(): PostHog | null {
  const token = process.env.NEXT_PUBLIC_POSTHOG_TOKEN
  if (!token) return null
  if (!posthogClient) {
    posthogClient = new PostHog(token, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    })
  }
  return posthogClient
}

type TrackOptions = {
  /**
   * Stable person id — the Supabase user id for signed-in users.
   *
   * Omit for anonymous traffic. We deliberately do not derive an id from the
   * client IP: that would rebuild the visitor tracking the product no longer
   * does. Anonymous events are still counted, just not attributed to a person,
   * and accurate anonymous volume lives in Postgres (public.anon_usage).
   */
  distinctId?: string
  properties?: Record<string, unknown>
}

export function trackServer(event: AnalyticsEvent, opts: TrackOptions = {}): void {
  const client = getPostHogClient()
  if (!client) return

  const anonymous = !opts.distinctId
  const distinctId = opts.distinctId ?? `anon:${crypto.randomUUID()}`

  try {
    client.capture({
      distinctId,
      event,
      properties: {
        ...opts.properties,
        // Counts the event without creating a person for a throwaway id.
        ...(anonymous ? { $process_person_profile: false } : {}),
      },
    })
    // Flush after the response is sent, so analytics never adds user-visible
    // latency and never fails the request it is describing.
    //
    // `after` throws outside a request scope, and some callers (the GitHub
    // webhook, the cron drains) already run inside an `after` callback. The
    // capture above has flushAt: 1 so it is queued for immediate send either
    // way; this just makes the flush best-effort rather than load-bearing.
    const flush = () => client.flush().catch(() => {})
    try {
      after(flush)
    } catch {
      void flush()
    }
  } catch {
    /* dropping an event is always better than failing a request */
  }
}
