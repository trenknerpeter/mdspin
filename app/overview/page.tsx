import Link from "next/link"
import type { Metadata } from "next"
import { SITE_URL, SITE_NAME } from "@/lib/seo"
import { SiteNav } from "@/components/site-nav"
import { SiteFooter } from "@/components/site-footer"
import { GrainOverlay } from "@/components/grain-overlay"

export const metadata: Metadata = {
  title: "PDF to Markdown for AI Workflows — Convert Documents with MDSpin",
  description:
    "Convert PDFs, DOCX, and PPTX to clean, structured Markdown for RAG, ChatGPT, and knowledge bases. MDSpin preserves structure so your AI understands your documents.",
  alternates: { canonical: `${SITE_URL}/overview` },
  openGraph: {
    title: "PDF to Markdown for AI Workflows | MDSpin",
    description:
      "Convert PDFs, DOCX, and PPTX to clean, structured Markdown for RAG, ChatGPT, and knowledge bases.",
    url: `${SITE_URL}/overview`,
  },
}

const supportedFormats = ["PDF", "DOCX", "PPTX", "HTML", "CSV", "TXT", "RTF"]

const stats = [
  { value: "~40%", label: "Token reduction" },
  { value: "~64%", label: "Retrieval accuracy boost" },
  { value: "2.4x", label: "Faster processing" },
]

const pipelineSteps = [
  { step: "1", title: "Ingest", description: "Collect documents from any source — uploads, email, cloud storage" },
  { step: "2", title: "Convert", description: "MDSpin transforms each file into clean, structured Markdown" },
  { step: "3", title: "Chunk", description: "Split Markdown along natural boundaries — headings, sections, paragraphs" },
  { step: "4", title: "Embed", description: "Feed clean chunks into your vector store for semantic search" },
  { step: "5", title: "Query", description: "Your LLM retrieves relevant chunks and generates accurate answers" },
]

export default function OverviewPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "PDF to Markdown for AI Workflows — MDSpin",
    description:
      "Convert PDFs, DOCX, and PPTX to clean, structured Markdown for RAG, ChatGPT, and knowledge bases.",
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
              Documents In, AI-Ready Markdown Out
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-[#888480]">
              Most AI tools choke on raw PDFs. The formatting that makes documents
              readable to humans makes them noisy, bloated, and confusing to machines.
              MDSpin fixes that.
            </p>
          </div>

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

          {/* Built for AI Workflows */}
          <section className="mb-16">
            <h2 className="mb-4 font-display text-2xl font-bold text-white">
              Built for AI Workflows
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-[#888480]">
              Whether you are building a RAG pipeline, populating a knowledge base, or
              prepping documents for ChatGPT, MDSpin sits at the front of your pipeline
              and handles the messy part.
            </p>
            <div className="space-y-3">
              {pipelineSteps.map((s) => (
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
              Ready to convert?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#888480]">
              Drop any document into MDSpin and get clean, AI-ready Markdown in seconds.
              No signup required.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/#converter"
                className="rounded-full bg-[#FF4800] px-6 py-2 text-sm font-semibold text-white transition-all hover:bg-[#e04200]"
              >
                Try MDSpin free
              </Link>
              <Link
                href="/formats"
                className="rounded-full border border-[#2A2A2A] px-6 py-2 text-sm font-medium text-[#888480] transition-colors hover:border-[#3A3A3A] hover:text-white"
              >
                See supported formats
              </Link>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
