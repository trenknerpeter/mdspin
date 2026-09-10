"use client"

import { useEffect, useState } from "react"
import {
  GATED_SERVICES,
  missingServices,
  readConsent,
  NO_CONSENT,
  type ConsentState,
  type UsercentricsConsentDetails,
} from "@/lib/consent/usercentrics"

declare global {
  interface Window {
    __ucCmp?: {
      getConsentDetails: () => Promise<UsercentricsConsentDetails | undefined>
      showFirstLayer: () => Promise<void> | void
      showSecondLayer: () => Promise<void> | void
    }
  }
}

/**
 * Every window event the CMP fires that can mean "the consent state changed".
 * Each one just triggers a re-read, so listening to more than strictly
 * necessary costs nothing and protects us if Usercentrics drops one.
 */
const CMP_EVENTS = [
  "UC_CMP_API_READY",
  "UC_UI_INITIALIZED",
  "UC_UI_VIEW_CHANGED",
  "UC_CONSENT_CHANGED",
] as const

export type UsercentricsConsent = {
  /** True once the CMP has told us what the visitor decided. */
  ready: boolean
  consent: ConsentState
}

/**
 * Tracks consent for the services Usercentrics cannot autoblock, because they
 * ship as bundled app code rather than as third-party script tags.
 *
 * Starts at "no consent" and stays there until the CMP says otherwise, so a
 * blocked, failed or slow-loading CMP never results in untracked consent.
 */
export function useUsercentricsConsent(): UsercentricsConsent {
  const [state, setState] = useState<UsercentricsConsent>({ ready: false, consent: NO_CONSENT })

  useEffect(() => {
    let active = true

    const refresh = async () => {
      const details = await window.__ucCmp?.getConsentDetails().catch(() => undefined)
      if (!active || !details) return

      if (process.env.NODE_ENV === "development") {
        const missing = missingServices(details)
        if (missing.length > 0) {
          console.warn(
            `[consent] Not defined as Data Processing Services in Usercentrics: ${missing.join(", ")}. ` +
              "They will stay blocked for every visitor until they are added.",
          )
        }
      }

      const consent = readConsent(details)
      // Keep the same object when nothing changed: the CMP fires several events
      // per interaction, and consumers key effects off this identity.
      setState((previous) =>
        previous.ready && GATED_SERVICES.every((s) => previous.consent[s] === consent[s])
          ? previous
          : { ready: true, consent },
      )
    }

    // The CMP may already have initialised before this component mounted.
    void refresh()
    for (const event of CMP_EVENTS) window.addEventListener(event, refresh)

    return () => {
      active = false
      for (const event of CMP_EVENTS) window.removeEventListener(event, refresh)
    }
  }, [])

  return state
}
