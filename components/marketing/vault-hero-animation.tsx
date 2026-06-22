"use client"

import { useEffect, useState } from "react"
import { FilePlus2, Library, Network, FileText, Search, Check, Sparkles, MousePointer2 } from "lucide-react"

const STEPS = ["Convert", "Vault", "Knowledge Map"]

const NAV = [
  { icon: FilePlus2, label: "Convert" },
  { icon: Library, label: "Vault" },
  { icon: Network, label: "Map" },
]

// Cursor target over each sidebar nav item (relative to the body container).
const CURSOR = [
  { top: 26, left: 20 },
  { top: 70, left: 20 },
  { top: 114, left: 20 },
]

const VAULT_ROWS = [
  { name: "Pricing-2026.md", tag: "Finance", dot: "#FF7A45", date: "1d" },
  { name: "User-interviews.md", tag: "Research", dot: "#3FB37F", date: "3d" },
  { name: "Roadmap.md", tag: "Product", dot: "#A87FE0", date: "5d" },
  { name: "Onboarding.md", tag: "HR", dot: "#5B8DEF", date: "1w" },
]

const NODES = [
  { cx: 158, cy: 122, r: 17, hl: true },
  { cx: 66, cy: 60, r: 10 },
  { cx: 82, cy: 188, r: 10 },
  { cx: 248, cy: 66, r: 10 },
  { cx: 252, cy: 180, r: 10 },
  { cx: 158, cy: 36, r: 7 },
  { cx: 176, cy: 220, r: 7 },
]
const EDGES = [
  [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6],
  [1, 5], [3, 5], [2, 6], [1, 2],
]

export function VaultHeroAnimation() {
  const [phase, setPhase] = useState(0)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReduced(true)
      return
    }
    const id = setInterval(() => setPhase((p) => (p + 1) % STEPS.length), 3400)
    return () => clearInterval(id)
  }, [])

  const screenCls = (active: boolean) =>
    `absolute inset-0 bg-[#0E0E0E] transition-opacity duration-300 ${active ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`
  const screenStyle = (active: boolean) => ({ transitionDelay: active ? "320ms" : "0ms" })
  const slide = (active: boolean) =>
    `transition-transform duration-500 ease-out ${active ? "translate-y-0" : "translate-y-2"}`
  const slideStyle = (active: boolean, i: number) => ({ transitionDelay: active ? `${360 + i * 70}ms` : "0ms" })

  const convertActive = phase === 0
  const vaultActive = phase === 1
  const mapActive = phase === 2

  return (
    <div className="relative mx-auto w-full max-w-lg lg:ml-auto lg:mr-0">
      <div className="pointer-events-none absolute -inset-12 rounded-full bg-[#FF4800]/10 blur-[100px]" />

      <div className="relative overflow-hidden rounded-2xl border border-[#262626] bg-[#0E0E0E] shadow-2xl shadow-black/60 ring-1 ring-white/[0.03]">
        {/* Top bar */}
        <div className="flex items-center gap-2 border-b border-[#1C1C1C] bg-[#0E0E0E] px-3.5 py-2.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#FF4800] font-display text-[11px] font-bold leading-none text-white">M</div>
          <span className="font-display text-xs font-semibold tracking-tight text-[#F0EDE8]">MDSpin</span>
          <span className="text-[11px] text-[#4A4A46]">/</span>
          <span className="text-[11px] font-medium text-[#888480] transition-all duration-300">{STEPS[phase]}</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#4ADE80]" />
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1E1E1E] text-[9px] font-medium text-[#888480]">P</div>
          </div>
        </div>

        {/* Body */}
        <div className="relative flex h-[320px]">
          {/* Sidebar */}
          <div className="flex w-[52px] shrink-0 flex-col items-center gap-2 border-r border-[#1C1C1C] bg-[#0B0B0B] py-4">
            {NAV.map((item, i) => {
              const active = i === phase
              return (
                <div
                  key={item.label}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-300 ${active ? "bg-[#FF4800]/15 text-[#FF4800]" : "text-[#4A4A46]"}`}
                >
                  <item.icon className="h-[18px] w-[18px]" />
                </div>
              )
            })}
            <div className="mt-auto h-7 w-7 rounded-full bg-[#1A1A1A]" />
          </div>

          {/* Main content */}
          <div className="relative flex-1 overflow-hidden">
            {/* ── Convert ── */}
            <div className={screenCls(convertActive)} style={screenStyle(convertActive)}>
              <div className="flex h-full flex-col justify-center gap-3 p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-[#4A4A46]">Convert a document</p>
                <div
                  style={slideStyle(convertActive, 0)}
                  className={`${slide(convertActive)} flex items-center gap-3 rounded-lg border border-[#262626] bg-[#161616] p-3`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#FF4800]/10">
                    <FileText className="h-4 w-4 text-[#FF4800]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-xs font-medium text-[#F0EDE8]">Q4-Report.pdf</span>
                      <span className="ml-auto shrink-0 text-[10px] text-[#4A4A46]">2.4 MB</span>
                    </div>
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[#262626]">
                      <div
                        className={`h-full rounded-full bg-[#FF4800] transition-all ease-out ${convertActive ? "w-full delay-[400ms] duration-[1500ms]" : "w-0 duration-0"}`}
                      />
                    </div>
                  </div>
                </div>

                <div
                  style={slideStyle(convertActive, 1)}
                  className={`${slide(convertActive)} rounded-lg border border-[#FF4800]/25 bg-[#161616] p-3.5`}
                >
                  <div className="mb-3 flex items-center gap-2 border-b border-[#262626] pb-2.5">
                    <span className="font-mono text-[10px] text-[#888480]">Q4-Report.md</span>
                    <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-[#4ADE80]">
                      <Check className="h-3 w-3" /> Converted
                    </span>
                  </div>
                  <p className="text-[13px] font-semibold leading-tight text-[#F0EDE8]">Q4 Report</p>
                  <p className="mt-2 text-[11px] font-semibold leading-tight text-[#b9b6b0]">Executive summary</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#6f6e6a]">
                    Revenue grew 24% YoY, driven by enterprise adoption and EMEA expansion.
                  </p>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-[#888480]">
                      <span className="text-[#FF4800]">•</span> ARR $4.2M <span className="text-[#4ADE80]">+24%</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-[#888480]">
                      <span className="text-[#FF4800]">•</span> NRR 118%
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Vault ── */}
            <div className={screenCls(vaultActive)} style={screenStyle(vaultActive)}>
              <div className="flex h-full flex-col p-4">
                <div style={slideStyle(vaultActive, 0)} className={`${slide(vaultActive)} mb-3 flex items-center gap-2`}>
                  <div className="flex flex-1 items-center gap-2 rounded-md border border-[#262626] bg-[#161616] px-2.5 py-1.5">
                    <Search className="h-3 w-3 text-[#4A4A46]" />
                    <span className="text-[10px] text-[#4A4A46]">Search your vault</span>
                  </div>
                  <span className="rounded-md bg-[#1E1E1E] px-2 py-1 text-[10px] text-[#888480]">5 items</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  {/* newly added row */}
                  <div
                    style={slideStyle(vaultActive, 1)}
                    className={`${slide(vaultActive)} flex items-center gap-2.5 rounded-lg border border-[#FF4800]/50 bg-[#FF4800]/[0.07] p-2`}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 text-[#FF4800]" />
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[#F0EDE8]">Q4-Report.md</span>
                    <span className="flex items-center gap-1 rounded bg-[#1A1A1A] px-1.5 py-0.5 text-[9px] text-[#888480]">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#FF7A45" }} /> Finance
                    </span>
                    <span className="flex items-center gap-1 text-[9px] font-medium text-[#FF4800]">
                      <Check className="h-2.5 w-2.5" /> added
                    </span>
                  </div>

                  {VAULT_ROWS.map((r, i) => (
                    <div
                      key={r.name}
                      style={slideStyle(vaultActive, i + 2)}
                      className={`${slide(vaultActive)} flex items-center gap-2.5 rounded-lg border border-[#262626] bg-[#161616] p-2`}
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-[#4A4A46]" />
                      <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[#cfccc6]">{r.name}</span>
                      <span className="flex items-center gap-1 rounded bg-[#1A1A1A] px-1.5 py-0.5 text-[9px] text-[#888480]">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: r.dot }} /> {r.tag}
                      </span>
                      <span className="w-6 shrink-0 text-right text-[9px] text-[#4A4A46]">{r.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Knowledge Map ── */}
            <div className={screenCls(mapActive)} style={screenStyle(mapActive)}>
              <div className="relative h-full">
                <svg viewBox="0 0 320 256" className="h-full w-full" role="img" aria-label="Knowledge map">
                  {EDGES.map(([a, b], i) => (
                    <line
                      key={i}
                      x1={NODES[a].cx}
                      y1={NODES[a].cy}
                      x2={NODES[b].cx}
                      y2={NODES[b].cy}
                      stroke={a === 0 || b === 0 ? "#FF4800" : "#262626"}
                      strokeOpacity={a === 0 || b === 0 ? 0.4 : 1}
                      strokeWidth="1"
                    />
                  ))}
                  {!reduced && (
                    <circle cx={NODES[0].cx} cy={NODES[0].cy} r={NODES[0].r} fill="none" stroke="#FF4800" strokeWidth="1.5">
                      <animate attributeName="r" values={`${NODES[0].r};${NODES[0].r + 15}`} dur="1.9s" repeatCount="indefinite" />
                      <animate attributeName="stroke-opacity" values="0.7;0" dur="1.9s" repeatCount="indefinite" />
                    </circle>
                  )}
                  {NODES.map((n, i) => (
                    <g key={i}>
                      <circle cx={n.cx} cy={n.cy} r={n.r} fill={n.hl ? "#FF4800" : "#1A1A1A"} stroke={n.hl ? "#FF4800" : "#3A3A3A"} strokeWidth="1" />
                      {n.hl && <FileTextGlyph cx={n.cx} cy={n.cy} />}
                    </g>
                  ))}
                </svg>

                {/* node tooltip */}
                <div
                  style={slideStyle(mapActive, 1)}
                  className={`${slide(mapActive)} absolute left-1/2 top-[58%] ml-3 rounded-lg border border-[#262626] bg-[#161616] px-2.5 py-1.5 shadow-lg shadow-black/40`}
                >
                  <div className="text-[10px] font-medium text-[#F0EDE8]">Q4-Report.md</div>
                  <div className="mt-0.5 flex items-center gap-1 text-[9px] text-[#FF4800]">
                    <Sparkles className="h-2.5 w-2.5" /> 5 connections
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Faux cursor navigating the sidebar */}
          <div
            className="pointer-events-none absolute z-30"
            style={{
              top: CURSOR[phase].top,
              left: CURSOR[phase].left,
              transition: reduced ? "none" : "top 700ms cubic-bezier(0.4,0,0.2,1), left 700ms cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            {!reduced && (
              <span className="absolute left-1.5 top-1.5 -z-10 h-6 w-6 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-[#FF4800]/25" />
            )}
            <MousePointer2 className="h-4 w-4 fill-white text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
          </div>
        </div>
      </div>
    </div>
  )
}

function FileTextGlyph({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity="0.95">
      <line x1={cx - 4} y1={cy - 3} x2={cx + 4} y2={cy - 3} />
      <line x1={cx - 4} y1={cy} x2={cx + 4} y2={cy} />
      <line x1={cx - 4} y1={cy + 3} x2={cx + 1} y2={cy + 3} />
    </g>
  )
}
