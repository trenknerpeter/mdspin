"use client"

import { FileText, CalendarDays, Type, Sparkles, Library } from "lucide-react"
import type { DashboardStats } from "@/lib/dashboard"

function compact(n: number): string {
  return n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 })
}

export function StatCards({ stats }: { stats: DashboardStats }) {
  const cards = [
    { label: "Total spins", value: stats.totalSpins.toLocaleString(), icon: FileText },
    { label: "This month", value: stats.spinsThisMonth.toLocaleString(), icon: CalendarDays },
    { label: "Words converted", value: compact(stats.totalWords), icon: Type },
    { label: "Briefs", value: stats.briefsGenerated.toLocaleString(), icon: Sparkles },
    { label: "In Vault", value: stats.vaultCount.toLocaleString(), icon: Library },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-4">
          <div className="flex items-center gap-2 text-[#4A4A46]">
            <c.icon className="h-3.5 w-3.5" strokeWidth={2} />
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em]">{c.label}</span>
          </div>
          <p className="mt-2 font-[family-name:var(--font-syne)] text-2xl font-bold text-[#F0EDE8]">
            {c.value}
          </p>
        </div>
      ))}
    </div>
  )
}
