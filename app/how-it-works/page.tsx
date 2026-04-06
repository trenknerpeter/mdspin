import Link from "next/link"
import type { Metadata } from "next"
import { SITE_URL, SITE_NAME } from "@/lib/seo"
import { SiteNav } from "@/components/site-nav"
import { SiteFooter } from "@/components/site-footer"
import { GrainOverlay } from "@/components/grain-overlay"

export const metadata: Metadata = {
  title: "How MDSpin Works — Web App, Chrome Extension & Batch Conversion",
  description:
    "Convert documents to Markdown three ways: drag-and-drop web app, Chrome extension for instant conversion, or batch processing for large document sets.",
  alternates: { canonical: `${SITE_URL}/how-it-works` },
  openGraph: {
    title: "How MDSpin Works — Web App, Chrome Extension & Batch Conversion",
    description:
      "Convert documents to Markdown three ways: drag-and-drop web app, Chrome extension, or batch processing.",
    url: `${SITE_URL}/how-it-works`,
  },
}

const conversionSteps = [
  {
    step: "1",
    title: "Upload or drop",
    description:
      "Drag files into the web app, use the Chrome extension on any page, or select files from your computer.",
  },
  {
    step: "2",
    title: "Parse structure",
    description:
      "MDSpin analyzes the document to identify headings, tables, lists, and reading order — not just raw text.",
  },
  {
    step: "3",
    title: "Generate Markdown",
    description:
      "Clean, semantic Markdown is generated with preserved hierarchy. Tables stay as tables, lists keep their structure.",
  },
  {
    step: "4",
    title: "Copy or download",
    description:
      "One-click copy to clipboard or download as a .md file. For batch jobs, merge everything into a single document.",
  },
]

export default function HowItWorksPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "How MDSpin Works",
    description:
      "Convert documents to Markdown three ways: web app, Chrome extension, or batch processing.",
    url: `${SITE_URL}/how-it-works`,
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  }

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "How It Works" },
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
              How It Works
            </p>
            <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
              Three Ways to Convert
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-[#888480]">
              Use the web app for quick conversions, the Chrome extension for
              in-browser convenience, or batch processing when you have a stack
              of files to handle.
            </p>
          </div>

          {/* The Conversion Process */}
          <section className="mb-16">
            <h2 className="mb-6 font-display text-2xl font-bold text-white">
              The Conversion Process
            </h2>
            <div className="space-y-3">
              {conversionSteps.map((s) => (
                <div
                  key={s.step}
                  className="flex items-start gap-4 rounded-xl border border-[#2A2A2A] bg-[#161616] p-4"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF4800]/15 font-display text-sm font-bold text-[#FF4800]">
                    {s.step}
                  </span>
                  <div>
                    <h3 className="text-sm font-medium text-[#F0EDE8]">
                      {s.title}
                    </h3>
                    <p className="mt-1 text-xs text-[#888480]">
                      {s.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Web App */}
          <section className="mb-16">
            <h2 className="mb-4 font-display text-2xl font-bold text-white">
              Drag, Drop, Done
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-[#888480]">
              The web app is the fastest way to convert a document. Drop your file
              into the converter, and MDSpin returns clean Markdown in seconds. No
              account needed, no data stored on our servers after processing.
            </p>
            <ul className="space-y-3">
              {[
                "No signup required — convert immediately",
                "Supports 7+ formats: PDF, DOCX, PPTX, HTML, CSV, TXT, RTF",
                "Batch up to 20 files at once",
                "Copy to clipboard or download as .md",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-sm text-[#888480]"
                >
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#FF4800]" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* Chrome Extension */}
          <section className="mb-16">
            <h2 className="mb-4 font-display text-2xl font-bold text-white">
              Convert While You Browse
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-[#888480]">
              The MDSpin Chrome extension lets you convert documents and web pages
              without leaving your browser. Click the extension icon on any page to
              turn it into clean Markdown, or use it on PDF and DOCX links you find
              online.
            </p>
            <ul className="mb-6 space-y-3">
              {[
                "Convert any web page to Markdown with one click",
                "Works on PDF and DOCX links directly",
                "Copy results to clipboard instantly",
                "No tab switching — stays in your workflow",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-sm text-[#888480]"
                >
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#FF4800]" />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="https://chromewebstore.google.com/detail/mdspin-%E2%80%94-file-to-markdown/jmiinicnfjhndcmmiominecphddngjae?hl=en-GB"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#FF4800]/10 px-4 py-1.5 text-xs font-semibold text-[#FF4800] transition-colors hover:bg-[#FF4800]/20"
            >
              Install from Chrome Web Store
            </Link>
          </section>

          {/* Batch Processing */}
          <section className="mb-16">
            <h2 className="mb-4 font-display text-2xl font-bold text-white">
              Process Multiple Files at Once
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-[#888480]">
              Need to convert a whole folder of documents? Drop up to 20 files into
              MDSpin and convert them all simultaneously. Each file is processed in
              parallel, so batch jobs finish fast.
            </p>
            <ul className="space-y-3">
              {[
                "Parallel conversion — all files processed simultaneously",
                "Merge results into a single Markdown document",
                "Download individual files or the merged result",
                "Mix formats freely — PDFs, DOCX, and PPTX in the same batch",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-sm text-[#888480]"
                >
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#FF4800]" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* Bottom CTA */}
          <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-10 text-center">
            <h2 className="font-display text-2xl font-bold text-white">
              Try it now
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#888480]">
              Convert your first document in seconds. No signup, no credit card.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/#converter"
                className="rounded-full bg-[#FF4800] px-6 py-2 text-sm font-semibold text-white transition-all hover:bg-[#e04200]"
              >
                Convert a document
              </Link>
              <Link
                href="https://chromewebstore.google.com/detail/mdspin-%E2%80%94-file-to-markdown/jmiinicnfjhndcmmiominecphddngjae?hl=en-GB"
              target="_blank"
              rel="noopener noreferrer"
                className="rounded-full border border-[#2A2A2A] px-6 py-2 text-sm font-medium text-[#888480] transition-colors hover:border-[#3A3A3A] hover:text-white"
              >
                Install Chrome extension
              </Link>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
