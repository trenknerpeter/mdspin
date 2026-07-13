import Link from "next/link"
import type { Metadata } from "next"
import { SITE_URL, SITE_NAME } from "@/lib/seo"
import { SiteNav } from "@/components/site-nav"
import { SiteFooter } from "@/components/site-footer"
import { GrainOverlay } from "@/components/grain-overlay"

export const metadata: Metadata = {
  title: "The Knowledge Hub for Your AI — How MDSpin Works",
  description:
    "MDSpin converts any document into clean Markdown, then organizes, connects, and synthesizes it into one searchable knowledge hub your AI can actually use.",
  alternates: { canonical: `${SITE_URL}/overview` },
  openGraph: {
    title: "The Knowledge Hub for Your AI | MDSpin",
    description:
      "Convert any document into clean Markdown, then build a connected, AI-ready knowledge hub.",
    url: `${SITE_URL}/overview`,
  },
}

const supportedFormats = ["PDF", "DOCX", "PPTX", "HTML", "CSV", "TXT", "RTF", "PNG", "JPG"]

const stats = [
  { value: "~40%", label: "Token reduction" },
  { value: "~64%", label: "Retrieval accuracy boost" },
  { value: "2.4x", label: "Faster processing" },
]

const hubLoop = [
  { step: "1", title: "Convert", description: "Drop any PDF, doc, or deck and get clean, structured Markdown — headings, tables, and lists intact." },
  { step: "2", title: "Organize", description: "Save conversions to your Vault, sorted into projects and tags with full-text search across everything." },
  { step: "3", title: "Connect", description: "MDSpin auto-detects related documents and links them into a force-directed knowledge map." },
  { step: "4", title: "Synthesize", description: "Generate an AI brief across a cluster of related docs — your library, read and summarized for you." },
]

const hubFeatures = [
  {
    title: "Knowledge Vault",
    detail:
      "Every conversion lands in one place instead of your downloads folder. Organize by project, tag freely, and search the full text of every document you've ever converted. Your knowledge base grows with each spin.",
  },
  {
    title: "Knowledge Map",
    detail:
      "A force-directed graph visualizes your whole vault, auto-clustered by project and connected by content similarity. See how ideas relate, find neighbors of any document, and surface links you'd never spot in a file list.",
  },
  {
    title: "Cluster Briefs",
    detail:
      "When documents are related, MDSpin can synthesize them. One click sends a cluster to an LLM and returns a brief that pulls the thread across every source — turning a pile of files into an answer.",
  },
]

export default function OverviewPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "The Knowledge Hub for Your AI — MDSpin",
    description:
      "Convert any document into clean Markdown, then organize, connect, and synthesize it into one searchable knowledge hub.",
    url: `${SITE_URL}/overview`,
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  }

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Overview" },
    ],
  }

  return (
    <div className="min-h-screen bg-[#0C0C0C] font-sans text-[#F0EDE8]">
      <GrainOverlay />
      <SiteNav />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      <main className="pb-24 pt-32">
        <div className="mx-auto max-w-3xl px-6">
          {/* Header */}
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#FF4800]">
              Product Overview
            </p>
            <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
              The Knowledge Hub for Your AI
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-[#888480]">
              MDSpin starts where every other converter stops. Conversion is the on-ramp —
              the real product is a connected, searchable hub where your documents become
              knowledge your AI can actually use.
            </p>
          </div>

          {/* The Hub Loop */}
          <section className="mb-16">
            <h2 className="mb-4 font-display text-2xl font-bold text-white">
              Convert once. Use it forever.
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-[#888480]">
              A converted file you can&apos;t find again is worthless. MDSpin closes the loop:
              every conversion is captured, organized, connected to what you already have, and
              ready to be synthesized on demand.
            </p>
            <div className="space-y-3">
              {hubLoop.map((s) => (
                <div
                  key={s.step}
                  className="flex items-start gap-4 rounded-xl border border-[#2A2A2A] bg-[#161616] p-4"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF4800]/15 font-display text-sm font-bold text-[#FF4800]">
                    {s.step}
                  </span>
                  <div>
                    <h3 className="text-sm font-medium text-[#F0EDE8]">{s.title}</h3>
                    <p className="mt-1 text-xs text-[#888480]">{s.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Hub Features */}
          <section className="mb-16">
            <h2 className="mb-4 font-display text-2xl font-bold text-white">
              More than a converter
            </h2>
            <div className="space-y-4">
              {hubFeatures.map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-6"
                >
                  <h3 className="mb-2 font-display text-lg font-semibold text-[#F0EDE8]">
                    {f.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-[#888480]">{f.detail}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Why Markdown for AI */}
          <section className="mb-16">
            <h2 className="mb-4 font-display text-2xl font-bold text-white">
              Why Markdown for AI
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-[#888480]">
              PDFs, Word documents, and slide decks store text inside layout containers —
              positioning coordinates, XML tags, shape objects. When you feed these directly
              to an LLM, the model spends tokens parsing noise instead of understanding content.
              Markdown strips all that away and exposes pure structure.
            </p>
            <ul className="space-y-3">
              {[
                "Headings become navigable sections, not graphic artifacts",
                "Tables stay as tables, not jumbled lines of text",
                "Lists keep their hierarchy and reading order",
                "Formatting noise is stripped — only semantic content remains",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-[#888480]">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#FF4800]" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* What MDSpin Does */}
          <section className="mb-16">
            <h2 className="mb-4 font-display text-2xl font-bold text-white">
              What MDSpin Does
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-[#888480]">
              MDSpin is a document-to-Markdown converter built specifically for AI workflows.
              Drop in a file, get back clean Markdown with headings, tables, and lists intact.
              No signup required, no data stored.
            </p>
            <div className="flex flex-wrap gap-2">
              {supportedFormats.map((format) => (
                <span
                  key={format}
                  className="rounded-md bg-[#FF4800]/15 px-2.5 py-1 font-mono text-xs font-semibold text-[#FF4800]"
                >
                  .{format.toLowerCase()}
                </span>
              ))}
            </div>
          </section>

          {/* Structure That Survives */}
          <section className="mb-16">
            <h2 className="mb-4 font-display text-2xl font-bold text-white">
              Structure That Survives Conversion
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-[#888480]">
              Most PDF-to-text tools dump everything into a flat wall of text. MDSpin
              does the opposite — it maps document structure to Markdown semantics so your
              AI can navigate the content the way a human would.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { title: "Headings", detail: "H1–H6 hierarchy preserved, so your RAG chunker can split on sections" },
                { title: "Tables", detail: "Data stays in Markdown table format, not comma-separated guesswork" },
                { title: "Lists", detail: "Ordered and unordered lists keep their nesting and sequence" },
                { title: "Emphasis", detail: "Bold, italic, and inline code survive — formatting cues that carry meaning" },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-6"
                >
                  <h3 className="mb-2 text-sm font-medium text-[#F0EDE8]">
                    {item.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-[#888480]">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Stats */}
          <div className="mb-16 rounded-xl border border-[#2A2A2A] bg-[#161616] p-8">
            <div className="grid grid-cols-3 gap-6 text-center">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <p className="font-display text-3xl font-bold text-[#FF4800]">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs text-[#888480]">{stat.label}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-xs text-[#4A4A46]">
              Based on internal benchmarks comparing raw PDF extraction vs. MDSpin Markdown output across common RAG workloads.
            </p>
          </div>

          {/* Bottom CTA */}
          <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-10 text-center">
            <h2 className="font-display text-2xl font-bold text-white">
              Start building your hub
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#888480]">
              Convert your first document free, then watch it become part of a connected,
              searchable knowledge hub your AI can use.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/auth/sign-up?next=/app"
                className="rounded-full bg-[#FF4800] px-6 py-2 text-sm font-semibold text-white transition-all hover:bg-[#e04200]"
              >
                Build your hub free
              </Link>
              <Link
                href="/#converter"
                className="rounded-full border border-[#2A2A2A] px-6 py-2 text-sm font-medium text-[#888480] transition-colors hover:border-[#3A3A3A] hover:text-white"
              >
                Try the converter
              </Link>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
