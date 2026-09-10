"use client"

/**
 * Reopens the Usercentrics preference centre. GDPR requires withdrawing
 * consent to be as easy as giving it, so this needs to stay reachable from
 * every page.
 */
export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => void window.__ucCmp?.showSecondLayer()}>
      Cookie settings
    </button>
  )
}
