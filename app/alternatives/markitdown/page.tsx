import Link from "next/link"
import type { Metadata } from "next"
import { Check, X } from "lucide-react"
import { SITE_URL, SITE_NAME } from "@/lib/seo"
import { SiteNav } from "@/components/site-nav"
import { SiteFooter } from "@/components/site-footer"
import { GrainOverlay } from "@/components/grain-overlay"
import { ConvertPageConverter } from "@/components/marketing/convert-page-converter"

export const metadata: Metadata = {
  title: "MarkItDown Alternative — No Python, No Command Line",
  description:
    "Looking for a MarkItDown alternative that doesn't require Python or the command line? MDSpin converts PDF, Word, PowerPoint, Google Slides, and images to Markdown in your browser — no install, no code.",
  alternates: { canonical: `${SITE_URL}/alternatives/markitdown` },
  openGraph: {
    title: "MarkItDown Alternative — No Python, No Command Line | MDSpin",
    description:
      "Looking for a MarkItDown alternative that doesn't require Python or the command line? MDSpin converts documents to Markdown in your browser — no install, no code.",
    url: `${SITE_URL}/alternatives/markitdown`,
  },
}

const rows = [
  {
    label: "Interface",
    markitdown: "Python library, run from the command line or your own code",
    mdOk: false,
    mdspin: "Web browser — drag and drop a file",
    spinOk: true,
  },
  {
    label: "Setup required",
    markitdown: "Install Python, set up an environment, pip install the package",
    mdOk: false,
    mdspin: "None — open mdspin.app",
    spinOk: true,
  },
  {
    label: "Coding required",
    markitdown: "Yes — CLI usage or Python scripting",
    mdOk: false,
    mdspin: "No",
    spinOk: true,
  },
  {
    label: "File formats",
    markitdown: "15+ formats including DOCX, XLSX, PPTX, PDF, HTML, audio",
    mdOk: true,
    mdspin: "11 formats: PDF, DOC/DOCX, PPTX, Google Slides, Apple Pages, RTF, TXT, HTML, images",
    spinOk: true,
  },
  {
    label: "Scanned pages & photos",
    markitdown: "Basic OCR — struggles with layout and tables",
    mdOk: false,
    mdspin: "AI vision, built in — headings and tables preserved",
    spinOk: true,
  },
  {
    label: "Batch conversion",
    markitdown: "Write your own script/loop",
    mdOk: false,
    mdspin: "Built in for signed-in users",
    spinOk: true,
  },
  {
    label: "Automation integration",
    markitdown: "None — wire it into your own pipeline",
    mdOk: false,
    mdspin: "Native Make.com app + Chrome extension",
    spinOk: true,
  },
  {
    label: "Where conversions go",
    markitdown: "Wherever your script writes the output",
    mdOk: false,
    mdspin: "Optional Knowledge Vault — organized, searchable, mapped",
    spinOk: true,
  },
  {
    label: "Cost",
    markitdown: "Free (MIT license), self-hosted",
    mdOk: true,
    mdspin: "Free during beta, hosted for you",
    spinOk: true,
  },
  {
    label: "Best for",
    markitdown: "Developers integrating conversion into their own pipeline",
    mdOk: true,
    mdspin: "Anyone who wants clean Markdown without writing code",
    spinOk: true,
  },
]

const faqs = [
  {
    question: "Is MDSpin a good alternative to MarkItDown?",
    answer:
      "Yes, if you're not a developer or don't want to run a Python script. Both tools convert documents to clean Markdown, but MarkItDown is a code library you install and run yourself, while MDSpin is a web app — you drop a file in a browser and get Markdown back, with no setup.",
  },
  {
    question: "Do I need to know how to code to use MDSpin?",
    answer:
      "No. MDSpin is a drag-and-drop web interface. MarkItDown requires installing Python and either running it from the command line or calling it from your own code — there's no way to use it without some coding knowledge.",
  },
  {
    question: "Does MDSpin support the same file formats as MarkItDown?",
    answer:
      "MDSpin covers the formats knowledge workers actually deal with day to day: PDF, Word (DOC/DOCX), PowerPoint (PPTX), Google Slides, Apple Pages, RTF, TXT, HTML, and images (PNG/JPG, via AI vision). MarkItDown supports a longer tail of formats including spreadsheets and audio transcription, since it's built as a general-purpose library rather than a focused conversion tool.",
  },
  {
    question: "Is MDSpin free like MarkItDown?",
    answer:
      "MarkItDown is free and open-source (MIT license) forever, but you provide your own compute to run it. MDSpin is free to use during its beta period, hosted — no infrastructure of your own required.",
  },
  {
    question: "Can I use MDSpin without installing anything?",
    answer:
      "Yes — that's the core difference. Go to the converter, drop a file, and get Markdown back. Nothing to install, no Python environment, no dependencies.",
  },
  {
    question: "Which one should I use — MarkItDown or MDSpin?",
    answer:
      "If you're a developer building document conversion into a data pipeline you control, MarkItDown's library form is a legitimate fit. If you're a product manager, consultant, operations lead, or anyone who wants to convert a file to Markdown without opening a terminal, MDSpin is built for you.",
  },
]

export default function MarkItDownAlternativePage() {
  const url = `${SITE_URL}/alternatives/markitdown`

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  }

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "MarkItDown Alternative" },
    ],
  }

  return (
    <div className="min-h-screen bg-[#0C0C0C] font-sans text-[#F0EDE8]">
      <GrainOverlay />
      <SiteNav />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      <main className="pb-24 pt-32">
        {/* Header — direct answer first */}
        <div className="mx-auto max-w-3xl px-6 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#FF4800]">
            MarkItDown alternative
          </p>
          <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
            A MarkItDown Alternative for Everyone Who Isn&apos;t a Developer
          </h1>
          <div className="mx-auto mt-6 max-w-2xl space-y-4 text-left">
            <p className="text-sm leading-relaxed text-[#888480]">
              MarkItDown is Microsoft&apos;s open-source Python library for converting documents
              to Markdown — and it&apos;s genuinely good at what it does. The catch: it&apos;s a
              library. Using it means installing Python, setting up an environment, and running
              it from the command line or your own code. If you don&apos;t write code, MarkItDown
              might as well not exist.
            </p>
            <p className="text-sm leading-relaxed text-[#888480]">
              MDSpin does the same core job — document to clean Markdown — as a web app instead of
              a code library. Drop a file in your browser, click Spin, get Markdown back. No
              Python, no terminal, no dependencies to manage.
            </p>
          </div>
        </div>

        {/* The tool */}
        <section className="mt-16">
          <ConvertPageConverter
            eyebrow="PDF · Word · PowerPoint · Images"
            heading="See it for yourself"
            subheading="Drop a file and get clean, AI-ready Markdown — no install required."
          />
        </section>

        <div className="mx-auto max-w-3xl px-6">
          {/* Comparison table */}
          <section className="mt-20">
            <h2 className="font-display text-2xl font-bold text-white">
              MarkItDown vs. MDSpin
            </h2>
            <div className="mt-6 overflow-hidden rounded-xl border border-[#2A2A2A]">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#2A2A2A] bg-[#161616]">
                    <th className="px-4 py-3 font-medium text-[#888480]"> </th>
                    <th className="px-4 py-3 font-medium text-[#888480]">MarkItDown</th>
                    <th className="px-4 py-3 font-medium text-[#F0EDE8]">MDSpin</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={row.label}
                      className={i % 2 === 0 ? "bg-[#0C0C0C]" : "bg-[#111111]"}
                    >
                      <td className="px-4 py-3 align-top font-medium text-[#F0EDE8]">
                        {row.label}
                      </td>
                      <td className="px-4 py-3 align-top text-[#888480]">
                        <span className="flex items-start gap-2">
                          {row.mdOk ? (
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#888480]" />
                          ) : (
                            <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#4A4A46]" />
                          )}
                          {row.markitdown}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-[#F0EDE8]">
                        <span className="flex items-start gap-2">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF4800]" />
                          {row.mdspin}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Where MarkItDown falls short */}
          <section className="mt-16">
            <h2 className="font-display text-2xl font-bold text-white">
              Where MarkItDown falls short for non-developers
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[#888480]">
              MarkItDown earned its 82,000 GitHub stars for good reason — it&apos;s a solid,
              free, actively maintained library, and Microsoft added an MCP server for it in
              2025 so it can be called directly from Claude Desktop and Cursor. None of that
              changes the fundamental shape of the tool: it is code you run, not a product you
              use.
            </p>
            <ul className="mt-4 space-y-2">
              {[
                "No web interface — everything happens through Python or the command line",
                "No hosted version — you provide the environment and the compute",
                "No connectors to Google Docs, Gmail, or other cloud sources — the file has to already be on disk",
                "No organization layer — you get raw Markdown output, then build your own system for storing and finding it later",
              ].map((point) => (
                <li key={point} className="flex items-start gap-2 text-sm text-[#888480]">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#FF4800]" />
                  {point}
                </li>
              ))}
            </ul>
          </section>

          {/* When MarkItDown is still the right call */}
          <section className="mt-16">
            <h2 className="font-display text-2xl font-bold text-white">
              When MarkItDown is still the right choice
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[#888480]">
              To be fair to it: if you&apos;re a developer building document ingestion into a
              pipeline you already control — a batch job, a RAG indexer, a script that runs on a
              schedule — a library you can call in-process is often the better fit than an API
              call to a hosted web app. MarkItDown is free forever, self-hosted, and has no
              per-conversion dependency on anyone else&apos;s uptime. If that describes your
              situation, use it.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-[#888480]">
              MDSpin is built for the much larger group of people that description doesn&apos;t
              cover: product managers, consultants, operations teams, researchers — anyone who
              needs a document turned into Markdown today, without opening a terminal.
            </p>
          </section>

          {/* FAQ */}
          <section className="mt-16">
            <h2 className="font-display text-2xl font-bold text-white">
              Frequently asked questions
            </h2>
            <div className="mt-6 space-y-8">
              {faqs.map((faq) => (
                <div key={faq.question}>
                  <h3 className="text-sm font-semibold text-white">{faq.question}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#888480]">{faq.answer}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Related */}
          <section className="mt-16">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#4A4A46]">
              Keep reading
            </h2>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/blog/mdspin-vs-competitors"
                  className="text-sm text-[#FF4800] transition-colors hover:text-[#e04200]"
                >
                  MDSpin vs. the competition: Docling, Firecrawl, Unstructured, and more →
                </Link>
              </li>
              <li>
                <Link
                  href="/convert/pdf-to-markdown"
                  className="text-sm text-[#FF4800] transition-colors hover:text-[#e04200]"
                >
                  PDF to Markdown converter →
                </Link>
              </li>
              <li>
                <Link
                  href="/formats"
                  className="text-sm text-[#FF4800] transition-colors hover:text-[#e04200]"
                >
                  All supported formats →
                </Link>
              </li>
              <li>
                <Link
                  href="/knowledge-vault"
                  className="text-sm text-[#FF4800] transition-colors hover:text-[#e04200]"
                >
                  What happens to your files after conversion — the Knowledge Vault →
                </Link>
              </li>
            </ul>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
