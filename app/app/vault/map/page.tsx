"use client"

import { VaultGalaxy } from "@/components/library/vault-galaxy"
import { VaultViewToggle } from "@/components/library/vault-view-toggle"

export default function VaultMapPage() {
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
