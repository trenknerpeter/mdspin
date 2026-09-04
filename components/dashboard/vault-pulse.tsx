"use client"

import Link from "next/link"
import { Plug, Upload, PenLine, FileText, Code, Library } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { sourceLabel, type VaultPulse as VaultPulseData } from "@/lib/dashboard"

const SOURCE_ICONS: Record<string, LucideIcon> = {
  mcp: Plug,
  upload: Upload,
  note: PenLine,
  conversion: FileText,
  api: Code,
}

// The hero block of the Vault-led dashboard: what showed up in the vault
// recently, and how it got there. Deliberately built on arrival counts only —
// no summary/brief counts, since the summary pipeline currently produces
// nothing (every doc sits at summary_status "pending"). Never renders a
// blank card: computeVaultPulse widens the window once before giving up.
export function VaultPulse({
  pulse,
  vaultCount,
}: {
  pulse: VaultPulseData
  vaultCount: number
}) {
  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4A4A46]">
          Vault pulse
        </span>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-[#4A4A46]">
          <Library className="h-3 w-3" />
          {vaultCount.toLocaleString()} docs in Vault
        </span>
      </div>

      {pulse.total === 0 ? (
        <div className="mt-4 flex flex-col items-start gap-1">
          <p className="font-sans text-sm text-[#888480]">
            Nothing new in the last {pulse.windowDays} days.
          </p>
          <Link
            href="/app/vault/add"
            className="text-sm text-[#FF4800] transition-colors hover:text-[#ff5f1f]"
          >
            Add to Vault →
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-3">
            <span className="font-display text-3xl font-bold text-[#F0EDE8]">{pulse.total}</span>{" "}
            <span className="text-sm text-[#888480]">new in the last {pulse.windowDays} days</span>
          </p>
          <ul className="mt-4 space-y-2">
            {pulse.bySource.map((b) => {
              const Icon = SOURCE_ICONS[b.sourceType] ?? FileText
              return (
                <li key={b.sourceType} className="flex items-center gap-2.5 text-sm">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-[#4A4A46]" strokeWidth={2} />
                  <span className="flex-1 text-[#C9C5BE]">{sourceLabel(b.sourceType)}</span>
                  <span className="font-mono text-xs text-[#888480]">{b.count}</span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
