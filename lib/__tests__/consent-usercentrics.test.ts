import { describe, expect, it } from "vitest"
import {
  findService,
  missingServices,
  readConsent,
  type UsercentricsConsentDetails,
} from "@/lib/consent/usercentrics"

const details = (services: UsercentricsConsentDetails["services"]): UsercentricsConsentDetails => ({
  consent: { fromUserAction: true },
  services,
})

describe("findService", () => {
  it("matches a service by its display name", () => {
    const found = findService(
      details({ "sX9-abc": { name: "PostHog", consent: { given: true } } }),
      "posthog",
    )
    expect(found?.name).toBe("PostHog")
  })

  it("matches case-insensitively", () => {
    const found = findService(
      details({ "sX9-abc": { name: "VERCEL WEB ANALYTICS", consent: { given: false } } }),
      "vercelAnalytics",
    )
    expect(found?.name).toBe("VERCEL WEB ANALYTICS")
  })

  it("matches on the service ID when the name is absent", () => {
    const found = findService(details({ posthog: { consent: { given: true } } }), "posthog")
    expect(found).toBeDefined()
  })

  it("does not confuse one gated service for another", () => {
    const found = findService(
      details({ a: { name: "PostHog", consent: { given: true } } }),
      "vercelAnalytics",
    )
    expect(found).toBeUndefined()
  })

  it("returns undefined for missing, empty and malformed payloads", () => {
    expect(findService(undefined, "posthog")).toBeUndefined()
    expect(findService(null, "posthog")).toBeUndefined()
    expect(findService({}, "posthog")).toBeUndefined()
    expect(findService(details({}), "posthog")).toBeUndefined()
    expect(findService(details({ a: undefined }), "posthog")).toBeUndefined()
  })
})

describe("readConsent", () => {
  it("reports consent per service independently", () => {
    expect(
      readConsent(
        details({
          a: { name: "PostHog", consent: { given: true } },
          b: { name: "Vercel Analytics", consent: { given: false } },
        }),
      ),
    ).toEqual({ posthog: true, vercelAnalytics: false })
  })

  it("fails closed when the CMP has not answered yet", () => {
    expect(readConsent(undefined)).toEqual({ posthog: false, vercelAnalytics: false })
  })

  it("fails closed when a service is missing from the CMP config", () => {
    expect(readConsent(details({ a: { name: "Google Fonts", consent: { given: true } } }))).toEqual({
      posthog: false,
      vercelAnalytics: false,
    })
  })

  it("treats a non-boolean consent flag as no consent", () => {
    const given = "true" as unknown as boolean
    expect(readConsent(details({ a: { name: "PostHog", consent: { given } } })).posthog).toBe(false)
  })

  it("treats a service with no consent object as no consent", () => {
    expect(readConsent(details({ a: { name: "PostHog" } })).posthog).toBe(false)
  })
})

describe("missingServices", () => {
  it("lists services absent from the CMP config", () => {
    expect(missingServices(details({ a: { name: "PostHog", consent: { given: false } } }))).toEqual([
      "vercelAnalytics",
    ])
  })

  it("lists nothing when both services are configured", () => {
    expect(
      missingServices(
        details({
          a: { name: "PostHog", consent: { given: false } },
          b: { name: "Vercel Analytics", consent: { given: false } },
        }),
      ),
    ).toEqual([])
  })

  it("lists everything when the CMP payload is unavailable", () => {
    expect(missingServices(undefined)).toEqual(["posthog", "vercelAnalytics"])
  })
})
