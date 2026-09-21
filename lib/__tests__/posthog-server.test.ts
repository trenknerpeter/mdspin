import { describe, it, expect, vi, beforeEach } from "vitest"
// Static imports are safe despite the mocks below: vitest hoists vi.mock above
// them. The token is read lazily inside trackServer, not at module load, so
// setting it after the import still takes effect.
import { trackServer } from "../posthog-server"
import { EVENTS } from "../analytics/events"

const capture = vi.fn()
const flush = vi.fn().mockResolvedValue(undefined)
const shutdown = vi.fn().mockResolvedValue(undefined)
const construct = vi.fn()

vi.mock("posthog-node", () => ({
  PostHog: class {
    capture = capture
    flush = flush
    shutdown = shutdown
    constructor(...args: unknown[]) {
      construct(...args)
    }
  },
}))

// Route handlers run inside a request scope; `after` defers work past the response.
const after = vi.fn((fn: () => unknown) => { void fn() })
vi.mock("next/server", () => ({ after: (fn: () => unknown) => after(fn) }))

process.env.NEXT_PUBLIC_POSTHOG_TOKEN = "phc_test"

beforeEach(() => {
  capture.mockClear(); flush.mockClear(); shutdown.mockClear()
  construct.mockClear(); after.mockClear()
})

describe("trackServer", () => {
  /**
   * The regression this file exists for. Callers used to `await posthog.shutdown()`
   * after every capture; because the client is a module-level singleton, the first
   * event on a warm serverless instance killed it and every later event from that
   * instance vanished silently. A single-event test cannot catch that — it takes
   * three in a row against one client.
   */
  it("keeps sending after the first event, and never shuts the client down", () => {
    trackServer(EVENTS.conversionSucceeded, { distinctId: "u1" })
    trackServer(EVENTS.conversionSucceeded, { distinctId: "u2" })
    trackServer(EVENTS.conversionSucceeded, { distinctId: "u3" })

    expect(capture).toHaveBeenCalledTimes(3)
    expect(shutdown).not.toHaveBeenCalled()
    // One client, reused — not one per event.
    expect(construct).toHaveBeenCalledTimes(1)
  })

  it("passes a signed-in user through as the distinct id", () => {
    trackServer(EVENTS.conversionSucceeded, { distinctId: "u1", properties: { source: "batch" } })

    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: "u1",
        event: "conversion_succeeded",
        properties: expect.objectContaining({ source: "batch" }),
      })
    )
    // A real person must still get a profile.
    expect(capture.mock.calls[0][0].properties).not.toHaveProperty("$process_person_profile")
  })

  it("counts anonymous events without creating a person", () => {
    trackServer(EVENTS.conversionFailed)

    const arg = capture.mock.calls[0][0]
    expect(arg.properties.$process_person_profile).toBe(false)
    expect(arg.distinctId).toMatch(/^anon:/)
  })

  it("gives each anonymous event its own id, so none are linkable", () => {
    trackServer(EVENTS.conversionFailed)
    trackServer(EVENTS.conversionFailed)

    expect(capture.mock.calls[0][0].distinctId).not.toBe(capture.mock.calls[1][0].distinctId)
  })

  it("still captures when `after` is unavailable (cron, nested after, no request scope)", () => {
    after.mockImplementationOnce(() => { throw new Error("after() outside a request scope") })

    expect(() => trackServer(EVENTS.githubSyncRan, { distinctId: "u1" })).not.toThrow()
    expect(capture).toHaveBeenCalledTimes(1)
  })

  it("never lets a broken analytics client fail the request it is describing", () => {
    capture.mockImplementationOnce(() => { throw new Error("posthog exploded") })

    expect(() => trackServer(EVENTS.paymentCompleted, { distinctId: "u1" })).not.toThrow()
  })
})
