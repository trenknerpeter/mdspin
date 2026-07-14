"use client"

import { useState } from "react"
import Link from "next/link"
import { Converter } from "@/components/converter/converter"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

// Client island for /convert/[slug] pages: the embedded converter plus the
// sign-in wall, so the page itself can stay a server component with metadata.
export function ConvertPageConverter({ eyebrow, heading, subheading }: {
  eyebrow: string
  heading: string
  subheading: string
}) {
  const [showWall, setShowWall] = useState(false)

  return (
    <>
      <Converter
        context="teaser"
        onAuthRequired={() => setShowWall(true)}
        eyebrow={eyebrow}
        heading={heading}
        subheading={subheading}
      />

      <Dialog open={showWall} onOpenChange={setShowWall}>
        <DialogContent>
          <DialogTitle>Sign in to keep converting</DialogTitle>
          <p className="text-sm text-[#888480]">
            You’ve used your free spins. Create a free account for 20 conversions a day,
            URL &amp; batch conversion, saved history, and conversion presets.
          </p>
          <div className="mt-4 flex gap-3">
            <Link href="/auth/sign-up?next=/app" className="rounded-full bg-[#FF4800] px-4 py-2 text-sm font-semibold text-white">Sign up free</Link>
            <Link href="/auth/sign-in?next=/app" className="rounded-full border border-[#2A2A2A] px-4 py-2 text-sm text-[#F0EDE8]">Sign in</Link>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
