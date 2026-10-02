"use client"

import { useState } from "react"
import { Converter } from "@/components/converter/converter"
import { SignInGateDialog } from "@/components/converter/sign-in-gate-dialog"

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

      <SignInGateDialog open={showWall} onOpenChange={setShowWall} />
    </>
  )
}
