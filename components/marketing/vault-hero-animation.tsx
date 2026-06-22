"use client"

import { useEffect, useState } from "react"
import { FileText, Check, Search, ChevronDown } from "lucide-react"

const STEPS = ["Convert", "My Vault", "Knowledge Map"]

const VAULT_FILES = [
  { name: "Onboarding.docx", tag: "HR" },
  { name: "Pricing-2026.pdf", tag: "Finance" },
  { name: "User-interviews.md", tag: "Research" },
  { name: "Roadmap.pptx", tag: "Product" },
  { name: "Competitor-scan.pdf", tag: "Research" },
  { name: "Q4-report.pdf", tag: "Finance", isNew: true },
]

const NODES = [
  { cx: 160, cy: 130, r: 18, hl: true },
  { cx: 68, cy: 66, r: 11 },
  { cx: 82, cy: 196, r: 11 },
  { cx: 252, cy: 70, r: 11 },
  { cx: 258, cy: 188, r: 11 },
  { cx: 160, cy: 38, r: 8 },
  { cx: 178, cy: 226, r: 8 },
]

const EDGES = [
  [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6],
  [1, 5], [3, 5], [2, 6], [1, 2],
]

export function VaultHeroAnimation() {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setPhase((p) => (p + 1) % STEPS.length), 3200)
    return () => clearInterval(id)
  }, [])

  // Clean swap: inactive screen fades out first (delay 0), active fades in after (delay 320ms) — no overlap.
  const screenCls = (active: boolean) =>
    `absolute inset-0 bg-[#111111] transition-opacity duration-300 ${active ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`
  const screenStyle = (active: boolean) => ({ transitionDelay: active ? "320ms" : "0ms" })

  // Inner elements slide up subtly as the panel appears.
  const slide = (active: boolean) =>
    `transition-transform duration-500 ease-out ${active ? "translate-y-0" : "translate-y-2"}`
  const slideStyle = (active: boolean, i: number) => ({ transitionDelay: active ? `${360 + i * 70}ms` : "0ms" })

  const convertActive = phase === 0
  const vaultActive = phase === 1
  const mapActive = phase === 2

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="pointer-events-none absolute -inset-10 rounded-full bg-[#FF4800]/10 blur-[90px]" />

      <div className="relative overflow-hidden rounded-2xl border border-[#2A2A2A] bg-[#111111] shadow-2xl shadow-black/40">
        {/* Window header */}
        <div className="relative z-20 flex items-center gap-2 border-b border-[#2A2A2A] bg-[#111111] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#2A2A2A]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#2A2A2A]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#2A2A2A]" />
          <span className="ml-2 font-mono text-xs text-[#888480]">{STEPS[phase]}</span>
          <div className="ml-auto flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === phase ? "w-5 bg-[#FF4800]" : "w-1.5 bg-[#2A2A2A]"}`}
              />
            ))}
          </div>
        </div>

        {/* Body — three stacked screens, clean sequential crossfade */}
        <div className="relative h-[300px]">
          {/* ── Screen 1: Convert ── */}
          <div className={screenCls(convertActive)} style={screenStyle(convertActive)}>
            <div className="flex h-full flex-col justify-center gap-3 p-5">
              <div
                style={slideStyle(convertActive, 0)}
                className={`${slide(convertActive)} flex items-center gap-3 rounded-lg border border-[#2A2A2A] bg-[#161616] p-3`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#FF4800]/10">
                  <FileText className="h-4 w-4 text-[#FF4800]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-[#F0EDE8]">Q4-report.pdf</div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[#2A2A2A]">
                    <div
                      className={`h-full rounded-full bg-[#FF4800] transition-all ease-out ${convertActive ? "w-full delay-[360ms] duration-[1400ms]" : "w-0 duration-0"}`}
                    />
                  </div>
                </div>
              </div>

              <div style={slideStyle(convertActive, 1)} className={`${slide(convertActive)} flex justify-center text-[#4A4A46]`}>
                <ChevronDown className="h-4 w-4" />
              </div>

              <div
                style={slideStyle(convertActive, 2)}
                className={`${slide(convertActive)} rounded-lg border border-[#FF4800]/25 bg-[#161616] p-3`}
              >
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="font-mono text-[10px] text-[#888480]">report.md</span>
                  <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-[#4ADE80]">
                    <Check className="h-3 w-3" />
                    Converted
                  </span>
                </div>
                <div className="space-y-1.5">
                  <div className="h-2 w-1/2 rounded bg-[#FF4800]/40" />
                  <div className="h-1.5 w-full rounded bg-[#2A2A2A]" />
                  <div className="h-1.5 w-5/6 rounded bg-[#2A2A2A]" />
                  <div className="h-1.5 w-2/3 rounded bg-[#2A2A2A]" />
                </div>
              </div>
            </div>
          </div>

          {/* ── Screen 2: Vault ── */}
          <div className={screenCls(vaultActive)} style={screenStyle(vaultActive)}>
            <div className="flex h-full flex-col p-5">
              <div style={slideStyle(vaultActive, 0)} className={`${slide(vaultActive)} mb-3 flex items-center gap-2`}>
                <div className="flex flex-1 items-center gap-2 rounded-md border border-[#2A2A2A] bg-[#161616] px-2.5 py-1.5">
                  <Search className="h-3 w-3 text-[#4A4A46]" />
                  <span className="text-[10px] text-[#4A4A46]">Search your vault</span>
                </div>
                <span className="rounded-md bg-[#1E1E1E] px-2 py-1 text-[10px] text-[#888480]">6 files</span>
              </div>

              <div className="grid flex-1 grid-cols-2 gap-2">
                {VAULT_FILES.map((f, i) => (
                  <div
                    key={f.name}
                    style={slideStyle(vaultActive, i)}
                    className={`${slide(vaultActive)} flex flex-col justify-between rounded-lg border p-2.5 ${f.isNew ? "border-[#FF4800]/50 bg-[#FF4800]/5" : "border-[#2A2A2A] bg-[#161616]"}`}
                  >
                    <div className="flex items-center justify-between">
                      <FileText className={`h-3.5 w-3.5 ${f.isNew ? "text-[#FF4800]" : "text-[#4A4A46]"}`} />
                      {f.isNew && <span className="text-[9px] font-medium text-[#FF4800]">+ added</span>}
                    </div>
                    <div className="mt-1 truncate text-[10px] font-medium text-[#F0EDE8]">{f.name}</div>
                    <span className="mt-1 w-fit rounded bg-[#1E1E1E] px-1.5 py-0.5 text-[9px] text-[#888480]">{f.tag}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Screen 3: Knowledge Map ── */}
          <div className={screenCls(mapActive)} style={screenStyle(mapActive)}>
            <div className="flex h-full items-center justify-center p-4">
              <svg viewBox="0 0 320 264" className="h-full w-full" role="img" aria-label="Knowledge map">
                {EDGES.map(([a, b], i) => (
                  <line
                    key={i}
                    x1={NODES[a].cx}
                    y1={NODES[a].cy}
                    x2={NODES[b].cx}
                    y2={NODES[b].cy}
                    stroke={a === 0 || b === 0 ? "#FF4800" : "#2A2A2A"}
                    strokeOpacity={a === 0 || b === 0 ? 0.35 : 1}
                    strokeWidth="1"
                  />
                ))}
                <circle cx={NODES[0].cx} cy={NODES[0].cy} r={NODES[0].r} fill="none" stroke="#FF4800" strokeWidth="1.5">
                  <animate attributeName="r" values={`${NODES[0].r};${NODES[0].r + 16}`} dur="1.8s" repeatCount="indefinite" />
                  <animate attributeName="stroke-opacity" values="0.7;0" dur="1.8s" repeatCount="indefinite" />
                </circle>
                {NODES.map((n, i) => (
                  <circle
                    key={i}
                    cx={n.cx}
                    cy={n.cy}
                    r={n.r}
                    fill={n.hl ? "#FF4800" : "#1A1A1A"}
                    stroke={n.hl ? "#FF4800" : "#3A3A3A"}
                    strokeWidth="1"
                  />
                ))}
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
