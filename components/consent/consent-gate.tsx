"use client"

import { useEffect, useRef } from "react"
import { Analytics } from "@vercel/analytics/next"
import { GATED_SERVICES } from "@/lib/consent/usercentrics"
import { startPostHog, stopPostHog } from "@/lib/consent/posthog"
import { useUsercentricsConsent } from "./use-usercentrics-consent"

/**
 * Applies the visitor's Usercentrics choice to the trackers the CMP autoblocker
 * cannot reach on its own.
 *
 * PostHog is bundled app code behind a first-party /ingest proxy and Vercel
 * Analytics is a React component, so neither looks like a third-party script
 * tag to the autoblocker. Both stay off until this turns them on.
 */
export function ConsentGate() {
  const { consent } = useUsercentricsConsent()
  const granted = useRef<typeof consent | null>(null)

  useEffect(() => {
    if (consent.posthog) startPostHog()
    else stopPostHog()
  }, [consent.posthog])

  useEffect(() => {
    const revoked = granted.current !== null && GATED_SERVICES.some((s) => granted.current![s] && !consent[s])
    granted.current = consent
    // Neither tracker can be fully unloaded once running: PostHog's SDK stays
    // resident and @vercel/analytics never removes the script tag it injected.
    // Withdrawal therefore only truly bites after a reload. Usercentrics has
    // already stored the new choice, so this settles rather than loops.
    if (revoked) window.location.reload()
  }, [consent])

  return consent.vercelAnalytics ? <Analytics /> : null
}
