"use client"

import Link from "next/link"
import { Sparkles } from "lucide-react"
import { useDashboard } from "@/components/dashboard/use-dashboard"
import { ConversionBand } from "@/components/dashboard/conversion-band"
import { VaultPulse } from "@/components/dashboard/vault-pulse"
import { ProjectsRail } from "@/components/dashboard/projects-rail"
import { RecentVault } from "@/components/dashboard/recent-vault"

export default function DashboardPage() {
  const d = useDashboard()
  const firstName = d.user?.email?.split("@")[0] ?? "there"

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-[#F0EDE8]">
          Welcome back, {firstName}
        </h1>
        <p className="font-sans text-sm text-[#888480]">
          Your knowledge layer at a glance.
        </p>
      </div>

      {d.loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <svg className="h-6 w-6 animate-spin text-[#FF4800]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      ) : d.error ? (
        <div className="rounded-xl border border-[#FF4800]/30 bg-[#161616] p-12 text-center">
          <p className="font-sans text-sm text-[#FF4800]">
            Couldn&apos;t load your dashboard: {d.error}
          </p>
          <button
            onClick={() => d.reload()}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#2A2A2A] px-5 py-2 text-sm font-semibold text-[#F0EDE8] transition-colors hover:border-[#4A4A46]"
          >
            Try again
          </button>
        </div>
      ) : d.stats.totalSpins === 0 && d.spinStats.total === 0 ? (
        // Both conversions AND the vault are empty. Gating on totalSpins
        // alone would hide the whole vault-led page from anyone who has
        // notes in the Vault but has never run a conversion.
        <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-12 text-center">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-[#4A4A46]" />
          <p className="font-sans text-sm text-[#888480]">
            Nothing here yet — convert a file or add to your Vault to get started.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <Link
              href="/app"
              className="inline-flex items-center gap-2 rounded-full bg-[#FF4800] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#e04200]"
            >
              Convert a file
            </Link>
            <Link
              href="/app/vault/add"
              className="inline-flex items-center gap-2 rounded-full border border-[#2A2A2A] px-5 py-2 text-sm font-semibold text-[#F0EDE8] transition-colors hover:border-[#4A4A46]"
            >
              Add to Vault
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <ConversionBand stats={d.stats} savings={d.savings} />
          <VaultPulse docs={d.vaultDocs} vaultCount={d.stats.vaultCount} />

          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <ProjectsRail
                projects={d.projects}
                stats={d.spinStats}
                lastActivity={d.projectActivity}
              />
            </div>
            <div className="lg:col-span-3">
              <RecentVault docs={d.vaultDocs} projects={d.projects} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
