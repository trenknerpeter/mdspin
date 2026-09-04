"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { DashboardStats, CumulativeSavings } from "@/lib/dashboard"

function compact(n: number): string {
  return n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 })
}

// Thin conversion-metrics strip at the top of the Vault-led dashboard. The
// old 5-card grid and the full savings/ROI breakdown moved to History —
// this just proves conversions still have a place, in one glance.
export function ConversionBand({
  stats,
  savings,
}: {
  stats: DashboardStats
  savings: CumulativeSavings
}) {
  const metrics = [
    { label: "Total spins", value: stats.totalSpins.toLocaleString() },
    { label: "This month", value: stats.spinsThisMonth.toLocaleString() },
    { label: "Words converted", value: compact(stats.totalWords) },
    {
      label: "Saved",
      value: savings.trackedCount === 0 ? "—" : `~$${savings.monthlySavings.toFixed(0)}/mo`,
      title:
        savings.trackedCount === 0
          ? undefined
          : "At 20 calls/mo — full breakdown in History",
    },
  ]

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[#2A2A2A] bg-[#161616] px-5 py-4 sm:flex-row sm:items-center">
      <div className="grid flex-1 grid-cols-2 divide-x divide-y divide-[#1E1E1E] sm:grid-cols-4 sm:divide-y-0">
        {metrics.map((m) => (
          <div key={m.label} className="px-3 py-1 first:pl-0 sm:py-0" title={m.title}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4A4A46]">
              {m.label}
            </p>
            <p className="mt-0.5 font-display text-lg font-bold text-[#F0EDE8]">{m.value}</p>
          </div>
        ))}
      </div>
      <Link
        href="/app/history"
        className="inline-flex shrink-0 items-center gap-1 self-start text-xs text-[#888480] transition-colors hover:text-[#F0EDE8] sm:self-center"
      >
        View all <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  )
}
