"use client"

import { useEffect } from "react"
import { VaultGalaxy } from "@/components/library/vault-galaxy"
import { VaultViewToggle } from "@/components/library/vault-view-toggle"
import { track } from "@/lib/analytics/client"
import { EVENTS } from "@/lib/analytics/events"

export default function VaultMapPage() {
  // Opening the Map leaves no database row (only dragging a node does, via
  // vault_map_positions), so this event is the only way to tell "nobody opens
  // it" apart from "people look but never rearrange".
  useEffect(() => {
    track(EVENTS.vaultMapOpened)
  }, [])

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#F0EDE8]">
            Map
          </h1>
          <p className="font-sans text-sm text-[#888480]">
            Your Vault as a galaxy — projects, their subprojects, and what&apos;s inside them.
          </p>
        </div>
        <VaultViewToggle active="map" />
      </div>

      <VaultGalaxy />
    </div>
  )
}
