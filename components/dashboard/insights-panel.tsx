"use client"

import { useMemo, useState } from "react"
import { TrendingDown } from "lucide-react"
import { computeCumulativeSavings, type DashboardRow } from "@/lib/dashboard"

export function InsightsPanel({ rows }: { rows: DashboardRow[] }) {
  const [monthlyCalls, setMonthlyCalls] = useState(20) // ROI reuse multiplier
  const savings = useMemo(() => computeCumulativeSavings(rows, monthlyCalls), [rows, monthlyCalls])

  const trackedFromLabel = savings.trackedFrom
    ? new Date(savings.trackedFrom).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null

  return (
    <div className="overflow-hidden rounded-xl border border-[#2A2A2A] bg-[#161616]">
      <div className="flex items-center gap-2 border-b border-[#2A2A2A] px-5 py-3">
        <TrendingDown className="h-3.5 w-3.5 text-[#FF4800]" strokeWidth={2} />
        <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[#FF4800]">
          Insights — Your Savings
        </span>
      </div>

      {savings.trackedCount === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="font-[family-name:var(--font-dm-sans)] text-sm text-[#888480]">
            Savings tracking starts with your next conversion.
          </p>
          <p className="mt-1 font-[family-name:var(--font-dm-sans)] text-xs text-[#4A4A46]">
            We measure the tokens you save by feeding LLMs clean Markdown instead of raw files.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 divide-x divide-y divide-[#1E1E1E]">
            <div className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4A4A46]">
                Token Reduction
              </p>
              <p className="mt-1.5 font-[family-name:var(--font-syne)] text-2xl font-bold text-[#FF4800]">
                &minus;{savings.reductionPct}%
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-[#888480]">
                ~{savings.tokensSaved.toLocaleString()} tokens saved
              </p>
            </div>
            <div className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4A4A46]">
                Cost Savings
              </p>
              <p className="mt-1.5 font-[family-name:var(--font-syne)] text-2xl font-bold text-[#FF4800]">
                ~${savings.monthlySavings.toFixed(2)}
                <span className="text-sm font-normal text-[#888480]">/mo</span>
              </p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="text-[10px] text-[#4A4A46]">at</span>
                <input
                  type="number"
                  min={1}
                  max={100000}
                  value={monthlyCalls}
                  onChange={(e) => setMonthlyCalls(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 rounded border border-[#2A2A2A] bg-[#0C0C0C] px-1.5 py-0.5 text-center font-mono text-[10px] text-[#F0EDE8] outline-none focus:border-[#FF4800]/40"
                />
                <span className="text-[10px] text-[#4A4A46]">calls/mo</span>
              </div>
            </div>
          </div>
          {trackedFromLabel && (
            <p className="border-t border-[#1E1E1E] px-5 py-2.5 text-[10px] text-[#4A4A46]">
              Exact savings tracked across {savings.trackedCount} conversion
              {savings.trackedCount !== 1 ? "s" : ""} since {trackedFromLabel}.
            </p>
          )}
        </>
      )}
    </div>
  )
}
