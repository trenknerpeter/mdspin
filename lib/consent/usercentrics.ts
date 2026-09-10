/**
 * Pure helpers for reading Usercentrics CMP consent state.
 *
 * `window.__ucCmp.getConsentDetails()` resolves to a payload keyed by
 * Usercentrics service IDs. Those IDs are generated in the Usercentrics admin
 * and change if a service is removed and re-added, so we match on the service
 * name too. Anything we cannot find is treated as "no consent" — a missing
 * service in the CMP config must never silently turn tracking back on.
 */

export type UsercentricsService = {
  name?: string
  consent?: { given?: boolean }
}

export type UsercentricsConsentDetails = {
  consent?: { fromUserAction?: boolean }
  services?: Record<string, UsercentricsService | undefined>
}

/** The trackers on MDSpin that Usercentrics cannot autoblock, so we gate them in code. */
export type GatedService = "posthog" | "vercelAnalytics"

export const GATED_SERVICES: GatedService[] = ["posthog", "vercelAnalytics"]

/** Lower-cased substrings matched against the Usercentrics service ID and name. */
const SERVICE_MATCHERS: Record<GatedService, string[]> = {
  posthog: ["posthog", "post hog"],
  vercelAnalytics: ["vercel analytics", "vercel web analytics"],
}

export type ConsentState = Record<GatedService, boolean>

export const NO_CONSENT: ConsentState = { posthog: false, vercelAnalytics: false }

/**
 * Find the CMP entry for one of our gated services, by ID or by display name.
 * Returns undefined when the service is absent from the Usercentrics config.
 */
export function findService(
  details: UsercentricsConsentDetails | null | undefined,
  service: GatedService,
): UsercentricsService | undefined {
  const services = details?.services
  if (!services) return undefined

  const matchers = SERVICE_MATCHERS[service]
  for (const [id, entry] of Object.entries(services)) {
    if (!entry) continue
    const haystack = `${id} ${entry.name ?? ""}`.toLowerCase()
    if (matchers.some((matcher) => haystack.includes(matcher))) return entry
  }
  return undefined
}

/** Read consent for every gated service. Fails closed on anything unexpected. */
export function readConsent(details: UsercentricsConsentDetails | null | undefined): ConsentState {
  return {
    posthog: findService(details, "posthog")?.consent?.given === true,
    vercelAnalytics: findService(details, "vercelAnalytics")?.consent?.given === true,
  }
}

/**
 * Gated services that the Usercentrics config does not define. These can never
 * be consented to, so surfacing them is the only way to notice a misconfigured
 * CMP rather than assuming visitors all declined.
 */
export function missingServices(
  details: UsercentricsConsentDetails | null | undefined,
): GatedService[] {
  return GATED_SERVICES.filter((service) => findService(details, service) === undefined)
}
