"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Upload, Copy, Download, Check, Sparkles, FileText, Zap, ArrowRight, LogOut, History, User, TrendingDown, Plus } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase/client"

type AppState = "idle" | "loaded" | "converting" | "done"
type WaitlistStatus = "idle" | "loading" | "success" | "error"

type ROIData = {
  mdTokens: number
  origTokens: number
  reductionPct: number
  savingsPerThousand: number
  speedup: number
  accuracyRange: string
}

const TEXT_DENSITY: Record<string, number> = {
  pdf: 0.35, docx: 0.45, doc: 0.30,
  txt: 0.90, rtf: 0.55, pages: 0.35,
}
const ACCURACY_RANGE: Record<string, string> = {
  pdf: "+55–70%", docx: "+45–65%", doc: "+45–65%",
  txt: "+15–30%", rtf: "+40–60%", pages: "+45–65%",
}

function calculateROI(file: File, markdown: string): ROIData {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "pdf"
  const density = TEXT_DENSITY[ext] ?? 0.40
  const mdTokens = Math.max(1, Math.round(markdown.length / 4))
  const origTokens = Math.max(mdTokens + 1, Math.round(file.size * density / 4))
  const reductionPct = Math.min(90, Math.max(5, Math.round((1 - mdTokens / origTokens) * 100)))
  const savingsPerThousand = Math.round((origTokens - mdTokens) * 0.000015 * 1000 * 100) / 100
  const speedup = Math.min(5.0, Math.max(1.1, origTokens / mdTokens))
  const accuracyRange = ACCURACY_RANGE[ext] ?? "+40–60%"
  return { mdTokens, origTokens, reductionPct, savingsPerThousand, speedup, accuracyRange }
}

const SUPPORTED_FORMATS = ["PDF", "DOC", "DOCX", "PPTX", "GSLIDES", "PAGES", "TXT", "RTF"]

export default function MDSpinPage() {
  const { user, isLoading: authLoading, signOut } = useAuth()
  const supabase = createClient()
  const [showUserMenu, setShowUserMenu] = useState(false)

  // --- converter state ---
  const [state, setState] = useState<AppState>("idle")
  const [fileName, setFileName] = useState<string>("")
  const [markdown, setMarkdown] = useState<string>("")
  const [copied, setCopied] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // --- rate limit state ---
  const [rateLimited, setRateLimited] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [dailyLimit, setDailyLimit] = useState<number | null>(null)

  // --- roi state ---
  const [roi, setRoi] = useState<ROIData | null>(null)
  const [monthlyCalls, setMonthlyCalls] = useState(20)

  // --- waitlist state ---
  const [waitlistEmail, setWaitlistEmail] = useState("")
  const [waitlistStatus, setWaitlistStatus] = useState<WaitlistStatus>("idle")

  useEffect(() => {
    setMounted(true)
  }, [])

  // --- converter handlers (preserved exactly) ---
  const handleFile = useCallback((droppedFile: File) => {
    setFileName(droppedFile.name)
    setFile(droppedFile)
    setState("loaded")
    setMarkdown("")
    setError(null)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleBrowse = () => {
    fileInputRef.current?.click()
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleSpin = async () => {
    if (state !== "loaded" || !file) return
    setState("converting")
    setError(null)

    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/convert", { method: "POST", body: fd })

      // Update rate limit state from response headers
      const limitHeader = res.headers.get("X-RateLimit-Limit")
      const remainingHeader = res.headers.get("X-RateLimit-Remaining")
      if (limitHeader) setDailyLimit(Number(limitHeader))
      if (remainingHeader) setRemaining(Number(remainingHeader))

      const data = await res.json()

      if (res.status === 429) {
        setRateLimited(true)
        setError(null)
        setState("loaded")
        return
      }

      if (!res.ok) {
        setError(data.message ?? "Conversion failed. Please try again.")
        setState("loaded")
        return
      }

      setMarkdown(data.markdown_text)
      setRoi(calculateROI(file, data.markdown_text))
      setState("done")

      // Save conversion (fire-and-forget; user_id null for anonymous)
      if (file) {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
        const wordCount = data.markdown_text.split(/\s+/).filter(Boolean).length
        supabase.from("conversions").insert({
          user_id: user?.id ?? null,
          filename: file.name,
          file_type: ext,
          word_count: wordCount,
          markdown_text: data.markdown_text,
        }).then(({ error }) => {
          if (error) console.error("[conversions] insert failed:", error.message)
        })
      }
    } catch {
      setError("Network error. Check your connection and try again.")
      setState("loaded")
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = fileName.replace(/\.[^/.]+$/, "") + ".md"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const resetApp = () => {
    setState("idle")
    setFileName("")
    setMarkdown("")
    setFile(null)
    setError(null)
    setRoi(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleNewConversion = () => {
    resetApp()
    setTimeout(() => {
      fileInputRef.current?.click()
    }, 50)
  }

  // --- waitlist handler ---
  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!waitlistEmail || waitlistStatus === "loading" || waitlistStatus === "success") return
    setWaitlistStatus("loading")
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: waitlistEmail }),
      })
      setWaitlistStatus(res.ok ? "success" : "error")
    } catch {
      setWaitlistStatus("error")
    }
  }

  return (
    <div className="min-h-screen bg-[#0C0C0C] font-sans text-[#F0EDE8]">
      {/* Grain overlay */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        }}
      />

      {/* ── Nav ── */}
      <nav className="fixed left-0 right-0 top-0 z-40 border-b border-[#1E1E1E] bg-[#0C0C0C]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="MDSpin" className="h-7 w-7 rounded-md" />
            <span className="font-display text-sm font-semibold tracking-tight text-white">MDSpin</span>
            <span className="rounded-full bg-[#FF4800]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#FF4800]">
              Beta
            </span>
            <Link
              href="/guides"
              className="ml-4 hidden text-sm text-[#888480] transition-colors hover:text-[#F0EDE8] sm:block"
            >
              Guides
            </Link>
            <Link
              href="/formats"
              className="hidden text-sm text-[#888480] transition-colors hover:text-[#F0EDE8] sm:block"
            >
              Formats
            </Link>
            <Link
              href="/blog"
              className="hidden text-sm text-[#888480] transition-colors hover:text-[#F0EDE8] sm:block"
            >
              Blog
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="#products"
              className="hidden text-sm text-[#888480] transition-colors hover:text-[#F0EDE8] sm:block"
            >
              Join waitlist
            </a>
            <a
              href="#converter"
              className="flex items-center gap-1.5 rounded-full bg-[#FF4800] px-4 py-1.5 text-xs font-semibold text-white transition-all hover:bg-[#e04200]"
            >
              Try it <ArrowRight className="h-3 w-3" />
            </a>
            {!authLoading && (
              user ? (
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FF4800]/20 text-xs font-semibold text-[#FF4800] transition-colors hover:bg-[#FF4800]/30"
                  >
                    {user.email?.[0]?.toUpperCase() ?? "U"}
                  </button>
                  {showUserMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                      <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-[#2A2A2A] bg-[#161616] py-1 shadow-xl">
                        <p className="truncate border-b border-[#2A2A2A] px-3 py-2 text-xs text-[#888480]">
                          {user.email}
                        </p>
                        <Link
                          href="/history"
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-[#F0EDE8] transition-colors hover:bg-[#1E1E1E]"
                        >
                          <History className="h-3.5 w-3.5" />
                          My Spins
                        </Link>
                        <button
                          onClick={() => { setShowUserMenu(false); signOut() }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#888480] transition-colors hover:bg-[#1E1E1E] hover:text-[#F0EDE8]"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          Sign out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <Link
                  href="/auth/sign-in"
                  className="flex items-center gap-1.5 rounded-full border border-[#2A2A2A] px-4 py-1.5 text-xs font-medium text-[#888480] transition-all hover:border-[#4A4A46] hover:text-[#F0EDE8]"
                >
                  <User className="h-3 w-3" />
                  Sign in
                </Link>
              )
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pb-28 pt-36">
        {/* Radial orange glow */}
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-[#FF4800]/8 blur-[140px]" />

        <div
          className={`relative z-10 mx-auto max-w-4xl px-6 text-center transition-all duration-700 ${mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#2A2A2A] bg-[#161616] px-4 py-1.5 text-xs text-[#888480]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF4800]" />
            Markdown is the input format your AI deserves
          </div>

          <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
            Stop feeding your
            <br />
            AI{" "}
            <span className="relative inline-block text-[#FF4800]">
              garbage.
              <svg
                className="absolute -bottom-1 left-0 h-[3px] w-full"
                viewBox="0 0 300 3"
                fill="none"
                preserveAspectRatio="none"
              >
                <path
                  d="M0 1.5 Q75 0.5 150 1.5 Q225 2.5 300 1.5"
                  stroke="#FF4800"
                  strokeWidth="2"
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: 320,
                    strokeDashoffset: mounted ? 0 : 320,
                    transition: "stroke-dashoffset 1.2s ease-out 0.6s",
                  }}
                />
              </svg>
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[#888480] sm:text-lg">
            PDF and DOCX files waste{" "}
            <span className="text-[#F0EDE8]">40% of your AI&apos;s token budget</span> on
            layout artifacts and formatting noise. Markdown is pure signal. MDSpin converts
            your docs into the format your AI actually reads.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#converter"
              className="flex items-center gap-2 rounded-full bg-[#FF4800] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#e04200] hover:shadow-lg hover:shadow-[#FF4800]/20"
            >
              Convert a file <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#products"
              className="flex items-center gap-2 rounded-full border border-[#2A2A2A] px-6 py-2.5 text-sm font-medium text-[#888480] transition-all hover:border-[#4A4A46] hover:text-[#F0EDE8]"
            >
              Join the waitlist
            </a>
          </div>
        </div>
      </section>

      {/* ── The Problem ── */}
      <section className="border-t border-[#1E1E1E] py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#FF4800]">
              The Problem
            </p>
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
              What your AI actually sees
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[#888480]">
              When you feed a PDF to an LLM, it doesn&apos;t see a document. It sees a stream
              of tokens polluted with layout artifacts, font metadata, and garbled characters.
              Markdown eliminates the noise.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* PDF → LLM */}
            <div className="overflow-hidden rounded-xl border border-[#2A2A2A] bg-[#161616]">
              <div className="flex items-center gap-2 border-b border-[#2A2A2A] px-4 py-3">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500/50" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/30" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-500/15" />
                <span className="ml-2 font-mono text-xs text-[#4A4A46]">document.pdf → LLM</span>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-xs leading-relaxed text-red-400/60">
{`%PDF-1.7 %%âãÏÓ3 0 obj
<</Type/Page/MediaBox
[0 0 612 792]/Contents
4 0 R/Resources<</Font
<</F1 5 0 R/F2 6 0 R>>
BT /F1 12 Tf 72 720 Td
(Q u a r t e r l y R e p)
0 -24 Td /F2 10 Tf
(\\316\\261\\304\\273\\302\\256)
Tj ET q 0.239 0.239 rg
/GS1 gs 72 710 540 1 re f`}
              </pre>
            </div>

            {/* Markdown → LLM */}
            <div className="overflow-hidden rounded-xl border border-[#FF4800]/25 bg-[#161616]">
              <div className="flex items-center gap-2 border-b border-[#FF4800]/20 px-4 py-3">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500/15" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/15" />
                <div className="h-2.5 w-2.5 rounded-full bg-[#FF4800]/50" />
                <span className="ml-2 font-mono text-xs text-[#4A4A46]">document.md → LLM</span>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-xs leading-relaxed text-[#F0EDE8]/70">
{`# Quarterly Report

## Executive Summary

Revenue grew 24% YoY driven by
enterprise adoption and new market
expansion in EMEA.

## Key Metrics

- ARR: $4.2M (+24% YoY)
- NRR: 118%
- Customers: 847 (+31% YoY)`}
              </pre>
            </div>
          </div>

          <p className="mt-4 text-center font-mono text-xs text-[#4A4A46]">
            Same document. One is signal, one is noise.
          </p>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-t border-[#1E1E1E] py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#FF4800]">
              Why It Matters
            </p>
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
              The numbers don&apos;t lie
            </h2>
          </div>

          <div className="grid grid-cols-2 overflow-hidden rounded-xl bg-[#1E1E1E] lg:grid-cols-4">
            {[
              { value: "+64%", label: "Retrieval Accuracy", sub: "vs. raw PDF input" },
              { value: "2.4×", label: "Faster Processing", sub: "document parsing speed" },
              { value: "−40%", label: "Token Costs", sub: "per document processed" },
              { value: "+16%", label: "Reasoning Accuracy", sub: "complex QA benchmarks" },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className={`bg-[#0C0C0C] p-8 text-center ${i < 3 ? "border-r border-[#1E1E1E]" : ""} ${i < 2 ? "border-b border-[#1E1E1E] lg:border-b-0" : ""}`}
              >
                <div className="font-display text-4xl font-extrabold text-[#FF4800] sm:text-5xl">
                  {stat.value}
                </div>
                <div className="mt-2 text-sm font-medium text-[#F0EDE8]">{stat.label}</div>
                <div className="mt-1 text-xs text-[#4A4A46]">{stat.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Converter ── */}
      <section id="converter" className="border-t border-[#1E1E1E] py-24">
        <div className="mx-auto max-w-2xl px-6">
          <div className="mb-10 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#FF4800]">
              The Converter
            </p>
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
              See it for yourself
            </h2>
            <p className="mt-3 text-sm text-[#888480]">
              Drop any document and get clean, AI-ready markdown in seconds.
            </p>
          </div>

          {/* Upload zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={state === "idle" ? handleBrowse : undefined}
            className={`
              group relative flex min-h-[200px] flex-col items-center justify-center
              rounded-xl border-2 border-dashed transition-all duration-300
              ${isDragOver
                ? "scale-[1.01] border-[#FF4800] bg-[#FF4800]/5 shadow-lg shadow-[#FF4800]/10"
                : "border-[#2A2A2A] bg-[#161616] hover:border-[#3A3A3A]"}
              ${state === "converting" ? "opacity-60" : ""}
              ${state === "idle" ? "cursor-pointer" : "cursor-default"}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.pptx,.gslides,.pages,.txt,.rtf"
              onChange={handleFileInput}
              className="hidden"
            />

            {state === "idle" && (
              <div className="flex flex-col items-center">
                <div
                  className={`mb-4 rounded-xl p-4 transition-all duration-300 ${
                    isDragOver
                      ? "bg-[#FF4800]/20"
                      : "bg-[#1E1E1E] group-hover:bg-[#2A2A2A]"
                  }`}
                >
                  <Upload
                    className={`h-6 w-6 transition-colors ${
                      isDragOver ? "text-[#FF4800]" : "text-[#4A4A46] group-hover:text-[#888480]"
                    }`}
                    strokeWidth={1.5}
                  />
                </div>
                <p className="text-sm font-medium text-[#888480]">Drop your file here</p>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleBrowse() }}
                  className="mt-1.5 text-sm text-[#4A4A46] underline underline-offset-4 transition-colors hover:text-[#FF4800]"
                >
                  or browse
                </button>
              </div>
            )}

            {(state === "loaded" || state === "converting" || state === "done") && (
              <div className="flex flex-col items-center">
                <div className="mb-3 rounded-xl bg-[#2A2A2A] p-3">
                  <FileText className="h-5 w-5 text-[#F0EDE8]" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-medium text-[#F0EDE8]">{fileName}</p>
                {state !== "done" && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); resetApp() }}
                    className="mt-2 text-xs text-[#4A4A46] transition-colors hover:text-[#888480]"
                  >
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Formats */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {SUPPORTED_FORMATS.map((format) => (
              <span
                key={format}
                className="rounded-full border border-[#2A2A2A] bg-[#161616] px-2.5 py-1 font-mono text-xs text-[#4A4A46]"
              >
                {format}
              </span>
            ))}
          </div>

          {/* Error */}
          {error && (
            <p className="mt-4 text-center text-sm text-red-400">{error}</p>
          )}

          {/* Spin button / Rate limit message */}
          <div className="mt-8 flex flex-col items-center gap-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSpin}
                disabled={state !== "loaded" || rateLimited}
                className={`
                  group relative flex h-12 min-w-[140px] items-center justify-center gap-2
                  rounded-full px-8 text-sm font-semibold transition-all duration-300
                  ${state === "loaded" && !rateLimited
                    ? "bg-[#FF4800] text-white shadow-lg shadow-[#FF4800]/25 hover:scale-105 hover:shadow-xl hover:shadow-[#FF4800]/30 active:scale-[0.98]"
                    : "cursor-not-allowed bg-[#1E1E1E] text-[#4A4A46]"}
                `}
              >
                {state === "converting" ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Converting
                  </span>
                ) : (
                  <>
                    <Sparkles className={`h-4 w-4 transition-transform ${state === "loaded" && !rateLimited ? "group-hover:rotate-12" : ""}`} />
                    Spin
                  </>
                )}
              </button>
              {state === "done" && (
                <button
                  type="button"
                  onClick={handleNewConversion}
                  className="flex h-12 items-center gap-2 rounded-full border border-[#2A2A2A] px-6 text-sm font-semibold text-[#888480] transition-all duration-300 hover:border-[#4A4A46] hover:text-[#F0EDE8]"
                >
                  <Plus className="h-4 w-4" />
                  New
                </button>
              )}
            </div>
            {remaining !== null && dailyLimit !== null && (
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs text-[#4A4A46]">
                  {remaining} of {dailyLimit} conversions remaining today
                </p>
                {remaining === 0 && !user && (
                  <Link
                    href="/auth/sign-in"
                    className="text-xs text-[#FF4800] underline underline-offset-2 hover:text-[#FF6633] transition-colors"
                  >
                    Sign in for up to 20 daily conversions
                  </Link>
                )}
                {rateLimited && user && (
                  <p className="text-xs text-[#4A4A46]">
                    Your limit resets at midnight UTC
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Output */}
          {state === "done" && markdown && (
            <div className="mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="overflow-hidden rounded-xl border border-[#2A2A2A]">
                <div className="flex items-center justify-between border-b border-[#2A2A2A] bg-[#161616] px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-[#FF4800]" />
                    <span className="text-xs font-medium text-[#888480]">Output ready</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="flex items-center gap-1.5 rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-1.5 text-xs font-medium text-[#888480] transition-all hover:border-[#4A4A46] hover:text-[#F0EDE8]"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Save .md
                    </button>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-1.5 text-xs font-medium text-[#888480] transition-all hover:border-[#4A4A46] hover:text-[#F0EDE8]"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-[#FF4800]" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <pre className="max-h-80 overflow-y-auto overflow-x-auto bg-[#0C0C0C] p-5 font-mono text-xs leading-relaxed text-[#F0EDE8]/75">
                  <code>{markdown}</code>
                </pre>
              </div>

              {/* ROI Panel */}
              {roi && (
                <div className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-500 overflow-hidden rounded-xl border border-[#2A2A2A] bg-[#161616]">
                  <div className="flex items-center gap-2 border-b border-[#2A2A2A] px-5 py-3">
                    <TrendingDown className="h-3.5 w-3.5 text-[#FF4800]" strokeWidth={2} />
                    <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[#FF4800]">Conversion Impact</span>
                    <span className="ml-auto text-[10px] text-[#4A4A46]">for {fileName}</span>
                  </div>

                  {/* 4 stat tiles */}
                  <div className="grid grid-cols-2 divide-x divide-y divide-[#1E1E1E]">
                    {/* Token reduction */}
                    <div className="p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4A4A46]">Token Reduction</p>
                      <p className="mt-1.5 font-display text-2xl font-bold text-[#FF4800]">−{roi.reductionPct}%</p>
                      <p className="mt-0.5 font-mono text-[10px] text-[#888480]">
                        ~{roi.origTokens.toLocaleString()} → ~{roi.mdTokens.toLocaleString()} tokens
                      </p>
                    </div>

                    {/* Processing speed */}
                    <div className="p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4A4A46]">Inference Speed</p>
                      <p className="mt-1.5 font-display text-2xl font-bold text-[#FF4800]">~{roi.speedup.toFixed(1)}×</p>
                      <p className="mt-0.5 font-mono text-[10px] text-[#888480]">faster processing</p>
                    </div>

                    {/* Cost savings */}
                    <div className="p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4A4A46]">Cost Savings</p>
                      <p className="mt-1.5 font-display text-2xl font-bold text-[#FF4800]">
                        ~${(roi.savingsPerThousand * monthlyCalls / 1000).toFixed(2)}
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

                    {/* Retrieval accuracy */}
                    <div className="p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4A4A46]">RAG Accuracy</p>
                      <p className="mt-1.5 font-display text-2xl font-bold text-[#FF4800]">{roi.accuracyRange}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-[#888480]">retrieval improvement</p>
                    </div>
                  </div>

                  <p className="border-t border-[#1E1E1E] px-5 py-2.5 text-[10px] leading-relaxed text-[#4A4A46]">
                    Estimates based on file-type heuristics and the ~4 chars/token approximation. Actual results vary by content and model.
                  </p>
                </div>
              )}

              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={resetApp}
                  className="flex items-center gap-2 text-sm text-[#4A4A46] transition-colors hover:text-[#888480]"
                >
                  <Zap className="h-3.5 w-3.5" />
                  Convert another file
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Products + Waitlist ── */}
      <section id="products" className="border-t border-[#1E1E1E] py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#FF4800]">
              Coming to Your Workflow
            </p>
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
              MDSpin everywhere you work
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[#888480]">
              The web converter is just the start. MDSpin is coming to the tools where your AI
              workflows actually live.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {/* Make.com */}
            <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-8 transition-colors hover:border-[#3A3A3A]">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#6D28D9]/15">
                <svg className="h-6 w-6 text-[#8B5CF6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v2.25A2.25 2.25 0 006 10.5zm0 9.75h2.25A2.25 2.25 0 0010.5 18v-2.25a2.25 2.25 0 00-2.25-2.25H6a2.25 2.25 0 00-2.25 2.25V18A2.25 2.25 0 006 20.25zm9.75-9.75H18a2.25 2.25 0 002.25-2.25V6A2.25 2.25 0 0018 3.75h-2.25A2.25 2.25 0 0013.5 6v2.25a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="font-display text-lg font-semibold text-[#F0EDE8]">Make.com App</h3>
                <span className="rounded-full bg-[#6D28D9]/15 px-2 py-0.5 text-[10px] font-semibold text-[#8B5CF6]">
                  Soon
                </span>
              </div>
              <p className="text-sm leading-relaxed text-[#888480]">
                Plug MDSpin into any automation. Trigger on new file uploads, pipe clean
                markdown directly to Claude, GPT, or any AI node in your workflow.
                Zero-friction document intelligence at scale.
              </p>
            </div>

            {/* Chrome Extension */}
            <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-8 transition-colors hover:border-[#3A3A3A]">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#4285F4]/15">
                <svg className="h-6 w-6 text-[#4285F4]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
              </div>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="font-display text-lg font-semibold text-[#F0EDE8]">Chrome Extension</h3>
                <span className="rounded-full bg-[#4285F4]/15 px-2 py-0.5 text-[10px] font-semibold text-[#4285F4]">
                  Soon
                </span>
              </div>
              <p className="text-sm leading-relaxed text-[#888480]">
                Convert docs without leaving ChatGPT, Claude, or Gemini. When you attach a
                file, MDSpin intercepts it and swaps in clean markdown — your AI gets signal,
                not noise.
              </p>
            </div>
          </div>

          {/* Email capture */}
          <div className="mt-8 rounded-xl border border-[#2A2A2A] bg-[#161616] p-8">
            <div className="mx-auto max-w-md text-center">
              {waitlistStatus === "success" ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FF4800]/15">
                    <Check className="h-6 w-6 text-[#FF4800]" />
                  </div>
                  <p className="font-display text-lg font-semibold text-[#F0EDE8]">
                    You&apos;re on the list.
                  </p>
                  <p className="text-sm text-[#888480]">
                    We&apos;ll reach out the moment Make.com and the Chrome Extension go live.
                  </p>
                </div>
              ) : (
                <>
                  <p className="font-display text-lg font-semibold text-[#F0EDE8]">
                    Get early access
                  </p>
                  <p className="mt-1.5 text-sm text-[#888480]">
                    Be first to know when Make.com and Chrome Extension launch.
                  </p>
                  <form onSubmit={handleWaitlist} className="mt-6 flex gap-2">
                    <input
                      type="email"
                      value={waitlistEmail}
                      onChange={(e) => setWaitlistEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                      className="flex-1 rounded-lg border border-[#2A2A2A] bg-[#0C0C0C] px-4 py-2.5 text-sm text-[#F0EDE8] placeholder-[#4A4A46] outline-none transition-all focus:border-[#FF4800]/40 focus:ring-1 focus:ring-[#FF4800]/15"
                    />
                    <button
                      type="submit"
                      disabled={waitlistStatus === "loading"}
                      className="flex items-center gap-2 rounded-lg bg-[#FF4800] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#e04200] disabled:opacity-60"
                    >
                      {waitlistStatus === "loading" ? (
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : (
                        "Notify me"
                      )}
                    </button>
                  </form>
                  {waitlistStatus === "error" && (
                    <p className="mt-2 text-xs text-red-400">Something went wrong. Try again.</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Guides ── */}
      <section className="border-t border-[#1E1E1E] py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-10 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#FF4800]">
              Learn
            </p>
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
              AI Document Processing Guides
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-[#888480]">
              Practical tutorials on converting documents for ChatGPT, Claude, and
              Gemini — reduce token costs, improve RAG accuracy, and streamline your
              AI workflows.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              href="/guides/convert-pdf-for-chatgpt"
              className="group rounded-xl border border-[#2A2A2A] bg-[#161616] p-6 transition-colors hover:border-[#3A3A3A]"
            >
              <h3 className="font-display text-sm font-semibold text-[#F0EDE8] transition-colors group-hover:text-white">
                How to Convert PDFs for ChatGPT, Claude & Gemini
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[#888480]">
                Stop losing context to messy PDF parsing. Convert to clean markdown first.
              </p>
            </Link>
            <Link
              href="/guides/reduce-ai-token-costs"
              className="group rounded-xl border border-[#2A2A2A] bg-[#161616] p-6 transition-colors hover:border-[#3A3A3A]"
            >
              <h3 className="font-display text-sm font-semibold text-[#F0EDE8] transition-colors group-hover:text-white">
                How to Cut AI Token Costs by 40%
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[#888480]">
                Document format is the biggest lever for reducing AI costs at scale.
              </p>
            </Link>
            <Link
              href="/guides/markdown-for-rag"
              className="group rounded-xl border border-[#2A2A2A] bg-[#161616] p-6 transition-colors hover:border-[#3A3A3A]"
            >
              <h3 className="font-display text-sm font-semibold text-[#F0EDE8] transition-colors group-hover:text-white">
                Why Markdown is the Best Format for RAG Pipelines
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[#888480]">
                Better chunking, better retrieval, better answers. It starts with format.
              </p>
            </Link>
            <Link
              href="/guides/document-preprocessing-for-ai"
              className="group rounded-xl border border-[#2A2A2A] bg-[#161616] p-6 transition-colors hover:border-[#3A3A3A]"
            >
              <h3 className="font-display text-sm font-semibold text-[#F0EDE8] transition-colors group-hover:text-white">
                Document Preprocessing for AI: The Complete Guide
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[#888480]">
                The most overlooked step in AI quality. Here is how to get it right.
              </p>
            </Link>
          </div>
          <div className="mt-6 text-center">
            <Link
              href="/guides"
              className="text-sm font-medium text-[#FF4800] transition-colors hover:text-[#e04200]"
            >
              View all guides
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#1E1E1E] py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="MDSpin" className="h-6 w-6 rounded-md opacity-50" />
            <span className="text-xs text-[#4A4A46]">MDSpin</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/guides" className="text-xs text-[#4A4A46] transition-colors hover:text-[#888480]">
              Guides
            </Link>
            <Link href="/formats" className="text-xs text-[#4A4A46] transition-colors hover:text-[#888480]">
              Formats
            </Link>
            <Link href="/blog" className="text-xs text-[#4A4A46] transition-colors hover:text-[#888480]">
              Blog
            </Link>
            <Link href="/privacy" className="text-xs text-[#4A4A46] transition-colors hover:text-[#888480]">
              Privacy
            </Link>
            <p className="text-xs text-[#4A4A46]">Drop, spin, done. &copy; {new Date().getFullYear()}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
