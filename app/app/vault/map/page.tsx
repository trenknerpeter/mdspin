"use client"

import { KnowledgeGraph } from "@/components/library/knowledge-graph"
import { VaultViewToggle } from "@/components/library/vault-view-toggle"

export default function VaultMapPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#F0EDE8]">
            Knowledge Map
          </h1>
          <p className="font-sans text-sm text-[#888480]">
            Your Vault as a connected graph — clustered by topic and project.
          </p>
        </div>
        <VaultViewToggle active="map" />
      </div>

      <KnowledgeGraph />
    </div>
  )
}
