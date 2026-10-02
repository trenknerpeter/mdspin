"use client"

import Link from "next/link"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { AUTH_DAILY_LIMIT } from "@/lib/usage-math"

// The one sign-in wall for signed-out converter users (home page and
// /convert/[slug]). `next=/app` matters: the converter on /app is what picks up
// the stashed file (lib/pending-conversion.ts) and re-converts it in full.
export function SignInGateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Get your full document — free</DialogTitle>
        <p className="text-sm text-[#888480]">
          Create a free account to copy, download or save the full Markdown. We’ll pick up
          your file right where you left off. Free includes {AUTH_DAILY_LIMIT} conversions a day,
          URL &amp; batch conversion, and your Knowledge Vault.
        </p>
        <div className="mt-4 flex gap-3">
          <Link href="/auth/sign-up?next=/app" className="rounded-full bg-[#FF4800] px-4 py-2 text-sm font-semibold text-white">Sign up free</Link>
          <Link href="/auth/sign-in?next=/app" className="rounded-full border border-[#2A2A2A] px-4 py-2 text-sm text-[#F0EDE8]">Sign in</Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}
