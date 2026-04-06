import Link from "next/link"
import type { Metadata } from "next"
import { SITE_URL, SITE_NAME } from "@/lib/seo"
import { SiteNav } from "@/components/site-nav"
import { SiteFooter } from "@/components/site-footer"
import { GrainOverlay } from "@/components/grain-overlay"

export const metadata: Metadata = {
  title: "Use Cases — Prepare Documents for ChatGPT, RAG & Knowledge Bases",
  description:
    "See how teams use MDSpin to convert PDFs and documents to Markdown for RAG pipelines, ChatGPT, knowledge bases, and AI-powered workflows.",
  alternates: { canonical: `${SITE_URL}/use-cases` },
  openGraph: {
    title: "Use Cases — Prepare Documents for ChatGPT, RAG & Knowledge Bases | MDSpin",
    description:
      "See how teams use MDSpin to convert documents to Markdown for RAG pipelines, ChatGPT, and AI workflows.",
    url: `${SITE_URL}/use-cases`,
  },
}

const useCases = [
  {
    title: "Knowledge Bases",
    subtitle: "Build searchable AI knowledge bases from document libraries",
    description:
      "Turn your existing document library — handbooks, SOPs, policy documents, internal wikis — into a structured knowledge base your AI can search and reason over. Markdown preserves the document hierarchy that makes retrieval accurate.",
    examples: [
      "Convert HR handbooks for AI-powered employee Q&A",
      "Process product documentation for customer support bots",
      "Transform training materials into searchable knowledge bases",
      "Migrate legacy wikis into AI-ready formats",
    ],
  },
  {
    title: "RAG Pipelines",
    subtitle: "Preprocess documents for retrieval-augmented generation",
    description:
      "Document quality is the single biggest lever in RAG performance. Clean Markdown with preserved headings and sections gives your chunking strategy natural boundaries, improving retrieval accuracy and reducing hallucinations.",
    examples: [
      "Preprocess research papers for literature review systems",
      "Convert legal documents for AI-powered contract analysis",
      "Prepare financial reports for automated due diligence",
      "Process technical specifications for AI code generation",
    ],
  },
  {
    title: "Content Teams",
    subtitle: "Convert editorial and marketing documents for AI workflows",
    description:
      "Content teams produce documents in every format — Word drafts, PDF reports, PowerPoint decks, Google Docs. MDSpin gives you a single, clean format that works with any AI tool for summarization, repurposing, and analysis.",
    examples: [
      "Convert whitepapers for AI-assisted content repurposing",
      "Process competitor reports for AI-powered analysis",
      "Transform interview transcripts for AI summarization",
      "Prepare research reports for AI content generation",
    ],
  },
  {
    title: "Developers",
    subtitle: "Integrate document conversion into dev tools and pipelines",
    description:
      "When you are building AI-powered applications, you need clean document input. MDSpin converts technical specs, API documentation, and requirement documents into Markdown that your models can parse reliably.",
    examples: [
      "Convert technical specs for AI code generation",
      "Process API documentation for developer assistants",
      "Transform requirement documents for automated testing",
      "Prepare architecture docs for AI-powered code review",
    ],
  },
  {
    title: "Consultants & Analysts",
    subtitle: "Convert client documents for AI-powered analysis",
    description:
      "Consultants and analysts receive documents in every format imaginable. Instead of manually restructuring each one, convert them all to clean Markdown and let AI handle the summarization, comparison, and insight extraction.",
    examples: [
      "Convert client pitch decks for AI-powered benchmarking",
      "Process financial statements for automated analysis",
      "Transform survey results for AI-assisted reporting",
      "Prepare board materials for AI summarization",
    ],
  },
]

export default function UseCasesPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Use Cases — MDSpin",
    description:
      "See how teams use MDSpin to convert documents to Markdown for RAG, ChatGPT, and AI workflows.",
    url: `${SITE_URL}/use-cases`,
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  }

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Use Cases" },
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
              Use Cases
            </p>
            <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
              From Documents to AI Insights
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-[#888480]">
              MDSpin bridges the gap between human-readable documents and AI-readable
              text. Here is how different teams use it to power their AI workflows.
            </p>
          </div>

          {/* Use case sections */}
          <div className="space-y-16">
            {useCases.map((uc) => (
              <section key={uc.title}>
                <h2 className="font-display text-2xl font-bold text-white">
                  {uc.title}
                </h2>
                <p className="mt-1 text-sm text-[#888480]">{uc.subtitle}</p>

                <p className="mt-4 text-sm leading-relaxed text-[#888480]">
                  {uc.description}
                </p>

                <div className="mt-6">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#4A4A46]">
                    Common examples
                  </h3>
                  <ul className="space-y-2">
                    {uc.examples.map((ex) => (
                      <li
                        key={ex}
                        className="flex items-start gap-2 text-sm text-[#888480]"
                      >
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#FF4800]" />
                        {ex}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6">
                  <Link
                    href="/#converter"
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#FF4800]/10 px-4 py-1.5 text-xs font-semibold text-[#FF4800] transition-colors hover:bg-[#FF4800]/20"
                  >
                    Convert now
                  </Link>
                </div>
              </section>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="mt-20 rounded-xl border border-[#2A2A2A] bg-[#161616] p-10 text-center">
            <h2 className="font-display text-2xl font-bold text-white">
              Ready to convert?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#888480]">
              Drop any document into MDSpin and get clean, AI-ready Markdown in
              seconds. No signup required.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/#converter"
                className="rounded-full bg-[#FF4800] px-6 py-2 text-sm font-semibold text-white transition-all hover:bg-[#e04200]"
              >
                Try MDSpin free
              </Link>
              <Link
                href="/guides"
                className="rounded-full border border-[#2A2A2A] px-6 py-2 text-sm font-medium text-[#888480] transition-colors hover:border-[#3A3A3A] hover:text-white"
              >
                Read the guides
              </Link>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
