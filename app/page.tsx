"use client"

import { useState, useEffect } from "react"
import { ArrowRight, FileText, Library, Share2, Sparkles } from "lucide-react"
import Link from "next/link"
import { SiteNav } from "@/components/site-nav"
import { Converter } from "@/components/converter/converter"
import { VaultHeroAnimation } from "@/components/marketing/vault-hero-animation"
import { useAuth } from "@/components/auth-provider"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

export default function MDSpinPage() {
  const { user } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [showWall, setShowWall] = useState(false)
  const getStartedHref = user ? "/app/dashboard" : "/auth/sign-up?next=/app"

  useEffect(() => {
    setMounted(true)
  }, [])

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
      <SiteNav />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pb-28 pt-36">
        {/* Radial orange glow */}
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-[#FF4800]/8 blur-[140px]" />

        <div
          className={`relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-6 transition-all duration-700 lg:grid-cols-2 ${mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}
        >
          {/* Left: copy */}
          <div className="text-center lg:text-left">
          {/* Product Hunt badge */}
          <div className="mb-6 flex justify-center lg:justify-start">
            <a
              href="https://www.producthunt.com/products/mdspin?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-mdspin"
              target="_blank"
              rel="noopener noreferrer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="MDSpin - File to Markdown converter | Product Hunt"
                width={250}
                height={54}
                src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1114548&theme=dark&t=1775293684923"
              />
            </a>
          </div>

          <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
            The knowledge hub
            <br />
            for your{" "}
            <span className="relative inline-block text-[#FF4800]">
              AI.
              <svg
                className="absolute -bottom-1 left-0 h-[3px] w-full"
                viewBox="0 0 60 3"
                fill="none"
                preserveAspectRatio="none"
              >
                <path
                  d="M0 1.5 Q15 0.5 30 1.5 Q45 2.5 60 1.5"
                  stroke="#FF4800"
                  strokeWidth="2"
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: 65,
                    strokeDashoffset: mounted ? 0 : 65,
                    transition: "stroke-dashoffset 1.2s ease-out 0.6s",
                  }}
                />
              </svg>
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[#888480] sm:text-lg lg:mx-0">
            Convert any document into clean Markdown — then organize, connect, and
            synthesize it into{" "}
            <span className="text-[#F0EDE8]">one searchable hub your AI actually understands.</span>
          </p>

          {/* CTA Buttons */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Link
              href={getStartedHref}
              className="flex items-center gap-2 rounded-full bg-[#FF4800] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#e04200] hover:shadow-lg hover:shadow-[#FF4800]/20"
            >
              Get started free <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#converter"
              className="flex items-center gap-2 rounded-full border border-[#2A2A2A] px-6 py-2.5 text-sm font-medium text-[#888480] transition-all hover:border-[#4A4A46] hover:text-[#F0EDE8]"
            >
              Convert a file <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          </div>

          {/* Right: vault animation */}
          <div className="mt-4 lg:mt-0">
            <VaultHeroAnimation />
          </div>
        </div>
      </section>

      {/* ── The Problem ── */}
      <section className="border-t border-[#1E1E1E] py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#FF4800]">
              The Problem
            </p>
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
              You convert. Then you forget.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[#888480]">
              Most converters hand you a Markdown file and you&apos;re done — until you need it
              again and it&apos;s buried in your downloads. The value was never the conversion.
              It&apos;s everything you do with the knowledge afterward.
            </p>
          </div>
        </div>
      </section>

      {/* ── The Hub Loop ── */}
      <section id="hub-loop" className="border-t border-[#1E1E1E] py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#FF4800]">
              How it works
            </p>
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
              Convert once. Use it forever.
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: FileText, step: "01", title: "Convert", body: "Drop any PDF, doc, or deck. Get clean Markdown." },
              { icon: Library, step: "02", title: "Organize", body: "Save to your Vault, sorted into projects and tags." },
              { icon: Share2, step: "03", title: "Connect", body: "MDSpin auto-links related documents into a knowledge map." },
              { icon: Sparkles, step: "04", title: "Synthesize", body: "Generate AI briefs across clusters of related docs." },
            ].map((s) => (
              <div
                key={s.title}
                className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-6 transition-colors hover:border-[#3A3A3A]"
              >
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FF4800]/10">
                    <s.icon className="h-5 w-5 text-[#FF4800]" />
                  </div>
                  <span className="font-mono text-xs text-[#4A4A46]">{s.step}</span>
                </div>
                <h3 className="font-display text-base font-semibold text-[#F0EDE8]">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#888480]">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature showcase ── */}
      <section id="features" className="border-t border-[#1E1E1E] py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#FF4800]">
              Your knowledge hub
            </p>
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
              More than a converter.
            </h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {/* Knowledge Vault */}
            <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-8 transition-colors hover:border-[#3A3A3A]">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#FF4800]/10">
                <Library className="h-6 w-6 text-[#FF4800]" />
              </div>
              <h3 className="font-display text-lg font-semibold text-[#F0EDE8]">Knowledge Vault</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#888480]">
                Every conversion, organized. Projects, tags, and full-text search across all
                your Markdown.
              </p>
            </div>

            {/* Knowledge Map — static SVG preview */}
            <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-8 transition-colors hover:border-[#3A3A3A]">
              <div className="mb-5 overflow-hidden rounded-lg border border-[#2A2A2A] bg-[#0C0C0C]">
                <svg viewBox="0 0 280 140" className="h-32 w-full" role="img" aria-label="Knowledge map preview">
                  {[
                    ["140", "70", "100", "40"], ["140", "70", "200", "45"],
                    ["140", "70", "90", "105"], ["140", "70", "205", "100"],
                    ["100", "40", "55", "70"], ["200", "45", "240", "85"],
                    ["90", "105", "150", "120"], ["205", "100", "150", "120"],
                  ].map(([x1, y1, x2, y2], i) => (
                    <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2A2A2A" strokeWidth="1" />
                  ))}
                  {[
                    ["140", "70", "7", "#FF4800"],
                    ["100", "40", "4.5", "#888480"], ["200", "45", "4.5", "#888480"],
                    ["90", "105", "4.5", "#888480"], ["205", "100", "4.5", "#888480"],
                    ["55", "70", "3.5", "#4A4A46"], ["240", "85", "3.5", "#4A4A46"],
                    ["150", "120", "3.5", "#4A4A46"],
                  ].map(([cx, cy, r, fill], i) => (
                    <circle key={i} cx={cx} cy={cy} r={r} fill={fill} />
                  ))}
                </svg>
              </div>
              <h3 className="font-display text-lg font-semibold text-[#F0EDE8]">Knowledge Map</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#888480]">
                A force-directed graph that auto-clusters your documents and surfaces
                connections you&apos;d miss.
              </p>
            </div>

            {/* Cluster Briefs */}
            <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-8 transition-colors hover:border-[#3A3A3A]">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#FF4800]/10">
                <Sparkles className="h-6 w-6 text-[#FF4800]" />
              </div>
              <h3 className="font-display text-lg font-semibold text-[#F0EDE8]">Cluster Briefs</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#888480]">
                One click synthesizes a brief across related documents — your AI reading your
                library for you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why clean Markdown ── */}
      <section className="border-t border-[#1E1E1E] py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#FF4800]">
              Why It&apos;s Clean
            </p>
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
              Your AI sees signal, not noise
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[#888480]">
              When you feed a PDF to an LLM, it doesn&apos;t see a document. It sees a stream
              of tokens polluted with layout artifacts, font metadata, and garbled characters.
              Markdown eliminates the noise — which is exactly why a hub built on it makes your
              AI smarter.
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
      <section className="border-t border-[#1E1E1E] py-24">
        <div className="mx-auto mb-12 max-w-5xl px-6 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#FF4800]">
            Start here
          </p>
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
            Try it now — then keep what you convert
          </h2>
        </div>
        <Converter context="teaser" onAuthRequired={() => setShowWall(true)} />
      </section>

      <Dialog open={showWall} onOpenChange={setShowWall}>
        <DialogContent>
          <DialogTitle>Sign in to keep converting</DialogTitle>
          <p className="text-sm text-[#888480]">
            You’ve used your free spins. Create a free account for 20 conversions a day,
            URL &amp; batch conversion, saved history, and conversion presets.
          </p>
          <div className="mt-4 flex gap-3">
            <Link href="/auth/sign-up?next=/app" className="rounded-full bg-[#FF4800] px-4 py-2 text-sm font-semibold text-white">Sign up free</Link>
            <Link href="/auth/sign-in?next=/app" className="rounded-full border border-[#2A2A2A] px-4 py-2 text-sm text-[#F0EDE8]">Sign in</Link>
          </div>
        </DialogContent>
      </Dialog>


      {/* ── Products ── */}
      <section id="products" className="border-t border-[#1E1E1E] py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#FF4800]">
              Feed your hub
            </p>
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
              Capture knowledge from anywhere
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[#888480]">
              MDSpin captures and cleans documents wherever they come from, then drops them
              straight into your hub.
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
                <span className="rounded-full bg-[#4ADE80]/15 px-2 py-0.5 text-[10px] font-semibold text-[#4ADE80]">
                  Released
                </span>
              </div>
              <p className="text-sm leading-relaxed text-[#888480]">
                Auto-ingest into your hub. Trigger on new file uploads and pipe clean markdown
                straight into your Vault — your knowledge base fills itself while you work.
              </p>
              <div className="mt-5">
                <a
                  href="https://www.make.com/en"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-[#2A2A2A] px-6 py-2.5 text-sm font-medium text-[#888480] transition-all hover:border-[#4A4A46] hover:text-[#F0EDE8]"
                >
                  Try it
                </a>
              </div>
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
                <span className="rounded-full bg-[#4ADE80]/15 px-2 py-0.5 text-[10px] font-semibold text-[#4ADE80]">
                  Released
                </span>
              </div>
              <p className="text-sm leading-relaxed text-[#888480]">
                Capture docs as you work. Convert without leaving ChatGPT, Claude, or Gemini —
                clean markdown in the moment, saved to your hub for later.
              </p>
              <div className="mt-5">
                <a
                  href="https://chromewebstore.google.com/detail/mdspin-%E2%80%94-file-to-markdown/jmiinicnfjhndcmmiominecphddngjae?hl=en-GB&authuser=0"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-[#2A2A2A] px-6 py-2.5 text-sm font-medium text-[#888480] transition-all hover:border-[#4A4A46] hover:text-[#F0EDE8]"
                >
                  Try it
                </a>
              </div>
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
            <Link href="/overview" className="text-xs text-[#4A4A46] transition-colors hover:text-[#888480]">
              Overview
            </Link>
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
            <Link href="https://github.com/trenknerpeter/mdspin" className="text-xs text-[#4A4A46] transition-colors hover:text-[#888480]">
              GitHub
            </Link>
            <p className="text-xs text-[#4A4A46]">Drop, spin, done. &copy; {new Date().getFullYear()}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
