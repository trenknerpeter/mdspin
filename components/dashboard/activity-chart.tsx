"use client"

import { useMemo } from "react"
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  type TooltipProps,
} from "recharts"
import type { ActivityPoint } from "@/lib/dashboard"

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const count = payload[0].value ?? 0
  const date = new Date(`${label}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
  return (
    <div className="rounded-md border border-[#2A2A2A] bg-[#0C0C0C] px-2.5 py-1.5 text-xs">
      <p className="font-medium text-[#F0EDE8]">
        {count} spin{count !== 1 ? "s" : ""}
      </p>
      <p className="text-[10px] text-[#4A4A46]">{date}</p>
    </div>
  )
}

export function ActivityChart({ data }: { data: ActivityPoint[] }) {
  // Tick labels only at the ends — keeps a 30-bar axis readable.
  const ticks = useMemo(
    () => (data.length ? [data[0].date, data[data.length - 1].date] : []),
    [data]
  )
  const fmtTick = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })

  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-4">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4A4A46]">
        Activity — Last 30 days
      </p>
      <div className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <XAxis
              dataKey="date"
              ticks={ticks}
              tickFormatter={fmtTick}
              tick={{ fill: "#4A4A46", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip cursor={{ fill: "#FFFFFF08" }} content={<CustomTooltip />} />
            <Bar dataKey="count" fill="#FF4800" radius={[2, 2, 0, 0]} maxBarSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
