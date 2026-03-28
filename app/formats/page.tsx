import Link from "next/link"
import type { Metadata } from "next"
import { SITE_URL, SITE_NAME } from "@/lib/seo"
import { ContentNav } from "@/components/content-nav"
import { SiteFooter } from "@/components/site-footer"
import { GrainOverlay } from "@/components/grain-overlay"

export const metadata: Metadata = {
  title: "Supported Formats — PDF, DOCX, PPTX to Markdown",
  description:
    "MDSpin converts PDF, DOCX, DOC, PPTX, Google Slides, Apple Pages, RTF, and TXT to clean, AI-ready Markdown. See how each format is handled.",
  alternates: { canonical: `${SITE_URL}/formats` },
  openGraph: {
    title: "Supported Formats — PDF, DOCX, PPTX to Markdown | MDSpin",
    description:
      "MDSpin converts PDF, DOCX, DOC, PPTX, Google Slides, Apple Pages, RTF, and TXT to clean, AI-ready Markdown.",
    url: `${SITE_URL}/formats`,
  },
}

const formats = [
  {
    name: "PDF to Markdown",
    slug: "pdf",
    ext: ".pdf",
    description:
      "PDF is the most common document format in business — reports, contracts, whitepapers, research papers. But PDFs are notoriously difficult for AI to process. The binary format stores text in positioning coordinates rather than reading order, which means standard PDF text extraction often produces garbled output with merged columns, lost tables, and broken headings.",
    details:
      "MDSpin extracts PDF content and converts it to clean Markdown that preserves heading hierarchy, table structure, and list formatting. Multi-column layouts are detected and reordered into linear reading flow. The result is Markdown that LLMs can parse perfectly — no more text soup from your quarterly reports.",
    useCases: [
      "Converting research papers for AI literature review",
      "Preparing contracts for AI-powered clause analysis",
      "Feeding whitepapers into RAG pipelines",
      "Extracting meeting minutes for AI summarization",
    ],
  },
  {
    name: "DOCX to Markdown",
    slug: "docx",
    ext: ".docx",
    description:
      "Microsoft Word documents are the workhorse of business communication — proposals, specifications, SOPs, internal memos. DOCX files contain rich formatting in XML, but most of that formatting is irrelevant to AI processing and inflates token counts.",
    details:
      "MDSpin converts DOCX files to Markdown while preserving the document's semantic structure: headings map to Markdown heading levels, tables become Markdown tables, and lists maintain their hierarchy. Tracked changes, comments, and formatting metadata are stripped, leaving only the content your AI needs.",
    useCases: [
      "Converting project specs for AI code generation",
      "Preparing SOPs for AI-powered knowledge bases",
      "Feeding proposals into document comparison workflows",
      "Processing HR documents for AI-assisted review",
    ],
  },
  {
    name: "PPTX to Markdown",
    slug: "pptx",
    ext: ".pptx",
    description:
      "Presentations contain some of the most valuable information in any organization — strategy decks, product roadmaps, client pitches, training materials. But the slide format makes them nearly impossible for AI to process meaningfully. Content is scattered across text boxes, shapes, and speaker notes with no inherent reading order.",
    details:
      "MDSpin processes each slide sequentially, extracting text from all content areas and speaker notes. The output uses Markdown headings to separate slides and preserves bullet hierarchies. The result is a linear, readable document that captures all the information in your presentation in a format LLMs can understand.",
    useCases: [
      "Converting training decks for AI-powered Q&A bots",
      "Preparing strategy presentations for AI summarization",
      "Feeding product roadmaps into planning tools",
      "Processing pitch decks for competitive intelligence",
    ],
  },
  {
    name: "HTML to Markdown",
    slug: "html",
    ext: ".html",
    description:
      "Web content, saved pages, and exported emails often come as HTML files. While HTML preserves document structure through tags, it carries massive overhead — CSS styles, JavaScript, navigation elements, advertisements, and metadata that inflate token counts by 2-5x without adding information.",
    details:
      "MDSpin strips HTML to its semantic core, converting headings, paragraphs, tables, lists, and links to clean Markdown. All presentational markup, scripts, and styles are removed. The result is a token-efficient representation of the content that preserves structure without the noise.",
    useCases: [
      "Converting saved web research for AI analysis",
      "Processing email exports for AI-powered search",
      "Cleaning web scraping output for RAG pipelines",
      "Preparing documentation exports for knowledge bases",
    ],
  },
  {
    name: "CSV to Markdown",
    slug: "csv",
    ext: ".csv",
    description:
      "Spreadsheet data exported as CSV is one of the most common data interchange formats. But raw CSV text — comma-separated values with no visual structure — is difficult for LLMs to interpret accurately. Models struggle to associate values with column headers and often misinterpret row boundaries.",
    details:
      "MDSpin converts CSV files to properly formatted Markdown tables with aligned columns and clear header rows. This gives LLMs the visual structure they need to accurately read tabular data, answer questions about specific cells, and perform data analysis tasks.",
    useCases: [
      "Converting data exports for AI-powered analysis",
      "Preparing spreadsheet data for LLM-based reporting",
      "Feeding structured data into AI assistants",
      "Processing survey results for AI summarization",
    ],
  },
  {
    name: "TXT to Markdown",
    slug: "txt",
    ext: ".txt",
    description:
      "Plain text files have no formatting at all — no headings, no emphasis, no tables. While they are token-efficient, they lack the structural cues that help LLMs understand document organization. A 50-page plain text document is a wall of undifferentiated text to an AI.",
    details:
      "MDSpin analyzes plain text files to detect implicit structure — lines that look like headings, content that follows list patterns, and tabular data separated by tabs or fixed widths. The output adds Markdown structure where appropriate, making the content more parseable for LLMs.",
    useCases: [
      "Adding structure to log files for AI analysis",
      "Converting legacy documentation for knowledge bases",
      "Preparing transcripts for AI summarization",
      "Structuring notes for AI-powered search",
    ],
  },
  {
    name: "RTF to Markdown",
    slug: "rtf",
    ext: ".rtf",
    description:
      "Rich Text Format files are found across legacy systems, older document management platforms, and cross-platform text editors. RTF encoding uses control codes for formatting that are completely opaque to LLMs and inflate token counts significantly.",
    details:
      "MDSpin strips RTF control codes and converts the underlying content to clean Markdown. Formatting like bold, italic, headings, and lists is preserved through Markdown syntax while all RTF-specific encoding is removed. The result is a clean, LLM-friendly document.",
    useCases: [
      "Converting legacy documents for modern AI workflows",
      "Processing older legal or medical records",
      "Migrating RTF knowledge bases to AI-ready formats",
      "Preparing archived content for RAG pipelines",
    ],
  },
]

export default function FormatsPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Supported Formats — MDSpin Document to Markdown Converter",
    description:
      "MDSpin converts PDF, DOCX, PPTX, HTML, CSV, TXT, and RTF to clean, AI-ready Markdown.",
    url: `${SITE_URL}/formats`,
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  }

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Supported Formats" },
    ],
  }

  return (
    <div className="min-h-screen bg-[#0C0C0C] font-sans text-[#F0EDE8]">
      <GrainOverlay />
      <ContentNav section="Formats" href="/formats" />

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
              Supported Formats
            </p>
            <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
              Every Format, Clean Markdown
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-[#888480]">
              MDSpin converts your documents into structured, AI-ready Markdown
              — preserving headings, tables, and lists while stripping formatting
              noise. Here is how each format is handled.
            </p>
          </div>

          {/* Format sections */}
          <div className="space-y-16">
            {formats.map((format) => (
              <section key={format.slug} id={format.slug}>
                <div className="mb-4 flex items-center gap-3">
                  <span className="rounded-md bg-[#FF4800]/15 px-2.5 py-1 font-mono text-xs font-semibold text-[#FF4800]">
                    {format.ext}
                  </span>
                  <h2 className="font-display text-2xl font-bold text-white">
                    {format.name}
                  </h2>
                </div>

                <p className="text-sm leading-relaxed text-[#888480]">
                  {format.description}
                </p>

                <p className="mt-4 text-sm leading-relaxed text-[#888480]">
                  {format.details}
                </p>

                <div className="mt-6">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#4A4A46]">
                    Common use cases
                  </h3>
                  <ul className="space-y-2">
                    {format.useCases.map((uc) => (
                      <li
                        key={uc}
                        className="flex items-start gap-2 text-sm text-[#888480]"
                      >
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#FF4800]" />
                        {uc}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6">
                  <Link
                    href="/#converter"
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#FF4800]/10 px-4 py-1.5 text-xs font-semibold text-[#FF4800] transition-colors hover:bg-[#FF4800]/20"
                  >
                    Convert {format.ext} now
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
              Drop any supported file into MDSpin and get clean, AI-ready
              Markdown in seconds. No signup required.
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
