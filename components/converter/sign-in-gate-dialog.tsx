"use client"

import Link from "next/link"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { AUTH_DAILY_LIMIT } from "@/lib/usage-math"

// The one sign-in wall for signed-out converter users (home page and
// /convert/[slug]). `next=/app` matters: the converter on /app is what picks up
// the stashed file (lib/pending-conversion.ts) and re-converts it in full.
//
// `reason` picks the wording: "preview" (default) when the user has just seen a
// truncated preview, "limit" when they already used their one free preview and
// the wall opens before anything converts — "get your full document" reads
// wrong when there is no document on screen.
export type GateReason = "preview" | "limit"

export function SignInGateDialog({ open, onOpenChange, reason = "preview" }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  reason?: GateReason
}) {
  const perks = <>Free includes {AUTH_DAILY_LIMIT} conversions a day, URL &amp; batch conversion, and your Knowledge Vault.</>
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {reason === "limit" ? (
          <>
            <DialogTitle>You’ve used your free preview</DialogTitle>
            <p className="text-sm text-[#888480]">
              Sign in or create a free account to convert this file. We’ll pick it up right
              where you left off. {perks}
            </p>
          </>
        ) : (
          <>
            <DialogTitle>Get your full document — free</DialogTitle>
            <p className="text-sm text-[#888480]">
              Create a free account to copy, download or save the full Markdown. We’ll pick up
              your file right where you left off. {perks}
            </p>
          </>
        )}
        <div className="mt-4 flex gap-3">
          <Link href="/auth/sign-up?next=/app" className="rounded-full bg-[#FF4800] px-4 py-2 text-sm font-semibold text-white">Sign up free</Link>
          <Link href="/auth/sign-in?next=/app" className="rounded-full border border-[#2A2A2A] px-4 py-2 text-sm text-[#F0EDE8]">Sign in</Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}
