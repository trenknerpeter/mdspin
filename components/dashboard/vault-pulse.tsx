"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Plug, Upload, PenLine, FileText, Code, Library } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, type TooltipProps } from "recharts"
import {
  computeVaultPulse,
  computeActivitySeries,
  sourceLabel,
  type ActivityPoint,
} from "@/lib/dashboard"
import type { Spin } from "@/lib/library"

const SOURCE_ICONS: Record<string, LucideIcon> = {
  mcp: Plug,
  upload: Upload,
  note: PenLine,
  conversion: FileText,
  api: Code,
}

const WINDOW_OPTIONS = [
  { days: 1, label: "Today" },
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
]

const windowLabel = (days: number) => (days === 1 ? "today" : `the last ${days} days`)

const fmtShortDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })

function SparklineTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const count = payload[0].value ?? 0
  return (
    <div className="rounded-md border border-[#2A2A2A] bg-[#0C0C0C] px-2.5 py-1.5 text-xs">
      <p className="font-medium text-[#F0EDE8]">
        {count} arrival{count !== 1 ? "s" : ""}
      </p>
      <p className="text-[10px] text-[#4A4A46]">{fmtShortDate(label)}</p>
    </div>
  )
}

// Trend of vault arrivals over the selected window. Skipped entirely for
// "Today" — a single bar isn't a trend, it's just the headline number
// repeated.
function ArrivalSparkline({ activity, windowDays }: { activity: ActivityPoint[]; windowDays: number }) {
  if (windowDays === 1 || activity.length === 0) return null
  return (
    <div className="mt-4">
      <p className="mb-1.5 text-[10px] text-[#4A4A46]">Arrivals — {windowLabel(windowDays)}</p>
      <div className="h-10 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={activity} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            {/* Hidden, not omitted: recharts needs an XAxis to resolve each
                bar's category, or the tooltip's `label` isn't the date at
                all — it comes through undefined ("Invalid Date" once
                formatted). */}
            <XAxis dataKey="date" hide />
            <Tooltip cursor={{ fill: "#FFFFFF08" }} content={<SparklineTooltip />} />
            <Bar dataKey="count" fill="#FF4800" radius={[1, 1, 0, 0]} maxBarSize={6} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-[#4A4A46]">
        <span>{fmtShortDate(activity[0].date)}</span>
        <span>{fmtShortDate(activity[activity.length - 1].date)}</span>
      </div>
    </div>
  )
}

// The hero block of the Vault-led dashboard: what showed up in the vault
// recently, and how it got there. Deliberately built on arrival counts only —
// no summary/brief counts, since the summary pipeline currently produces
// nothing (every doc sits at summary_status "pending").
//
// Window is user-controlled (Today/7/30), not auto-widened: an earlier version
// silently switched from 7 to 30 days when 7 was empty, which meant the
// headline and the (then-fixed-30-day) chart could describe different
// windows. Explicit control removes that mismatch — an empty window is a
// legitimate answer, and the user can pick a wider one on purpose.
export function VaultPulse({ docs, vaultCount }: { docs: Spin[]; vaultCount: number }) {
  const [windowDays, setWindowDays] = useState(7)
  const pulse = useMemo(
    () => computeVaultPulse(docs, { windowDays, fallbackDays: windowDays }),
    [docs, windowDays]
  )
  const activity = useMemo(() => computeActivitySeries(docs, windowDays), [docs, windowDays])

  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4A4A46]">
          Vault pulse
        </span>
        <div className="flex items-center gap-3">
          <select
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value))}
            className="rounded-lg border border-[#2A2A2A] bg-[#0C0C0C] px-2 py-1 text-[10px] text-[#888480] focus:border-[#4A4A46] focus:outline-none"
          >
            {WINDOW_OPTIONS.map((o) => (
              <option key={o.days} value={o.days}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="inline-flex items-center gap-1.5 text-[10px] text-[#4A4A46]">
            <Library className="h-3 w-3" />
            {vaultCount.toLocaleString()} docs in Vault
          </span>
        </div>
      </div>

      {pulse.total === 0 ? (
        <div className="mt-4 flex flex-col items-start gap-1">
          <p className="font-sans text-sm text-[#888480]">
            Nothing new {windowLabel(windowDays)}.
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
            <span className="font-display text-3xl font-bold text-[#FF4800]">{pulse.total}</span>{" "}
            <span className="text-sm text-[#888480]">new {windowLabel(windowDays)}</span>
          </p>
          <ArrivalSparkline activity={activity} windowDays={windowDays} />
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
