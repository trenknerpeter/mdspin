import Link from "next/link"
import type { Metadata } from "next"
import { SITE_URL, SITE_NAME } from "@/lib/seo"
import { SiteNav } from "@/components/site-nav"
import { SiteFooter } from "@/components/site-footer"
import { GrainOverlay } from "@/components/grain-overlay"

export const metadata: Metadata = {
  title: "Document Conversion API — PDF to Markdown API",
  description:
    "Programmatically convert PDF, DOCX, and PPTX to clean Markdown with the MDSpin API. Built for RAG pipelines, knowledge bases, and AI workflows.",
  alternates: { canonical: `${SITE_URL}/developer-api` },
  openGraph: {
    title: "Document Conversion API — PDF to Markdown API | MDSpin",
    description:
      "Programmatically convert PDF, DOCX, and PPTX to clean Markdown with the MDSpin API.",
    url: `${SITE_URL}/developer-api`,
  },
}

const features = [
  {
    title: "Single File Conversion",
    description: "Convert one document per request with a simple multipart upload.",
  },
  {
    title: "Batch Processing",
    description: "Convert multiple files in a single API call for pipeline efficiency.",
  },
  {
    title: "Format Detection",
    description: "Automatic identification of PDF, DOCX, PPTX, and 5 other formats.",
  },
  {
    title: "Structured Output",
    description: "Clean Markdown with preserved headings, tables, lists, and emphasis.",
  },
]

const builtFor = [
  {
    title: "RAG Pipelines",
    description:
      "Preprocess documents before embedding. Clean Markdown with section boundaries gives your chunker natural split points.",
  },
  {
    title: "Knowledge Bases",
    description:
      "Automate document ingestion into your knowledge base. Convert uploads on arrival without manual intervention.",
  },
  {
    title: "AI Applications",
    description:
      "Feed clean, structured text to LLMs. Reduce token costs and improve response quality with noise-free input.",
  },
]

export default function DeveloperApiPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Document Conversion API — MDSpin",
    description:
      "Programmatically convert PDF, DOCX, and PPTX to clean Markdown with the MDSpin API.",
    url: `${SITE_URL}/developer-api`,
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  }

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "API" },
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
            <div className="mb-3 flex items-center justify-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF4800]">
                API
              </p>
              <span className="rounded-full bg-[#FF4800]/15 px-3 py-1 text-xs font-semibold text-[#FF4800]">
                Coming Soon
              </span>
            </div>
            <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
              Document Conversion API
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-[#888480]">
              Programmatic access to MDSpin&apos;s conversion engine. Convert PDF, DOCX,
              PPTX, and more to clean Markdown — directly from your application.
            </p>
          </div>

          {/* What You'll Get */}
          <section className="mb-16">
            <h2 className="mb-6 font-display text-2xl font-bold text-white">
              Conversion at Scale
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-[#888480]">
              A REST API for integrating document-to-Markdown conversion into your
              applications, pipelines, and automation workflows.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-6"
                >
                  <h3 className="mb-2 text-sm font-medium text-[#F0EDE8]">
                    {f.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-[#888480]">
                    {f.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* API Preview */}
          <section className="mb-16">
            <h2 className="mb-6 font-display text-2xl font-bold text-white">
              Simple Integration
            </h2>
            <div className="rounded-lg bg-[#1E1E1E] p-4">
              <pre className="overflow-x-auto font-mono text-xs text-[#F0EDE8]">
{`POST /api/convert
Content-Type: multipart/form-data

---

Response:
{
  "markdown": "# Document Title\\n\\nContent...",
  "wordCount": 1250,
  "fileType": "pdf"
}`}
              </pre>
            </div>
            <p className="mt-4 text-sm text-[#888480]">
              Supported formats:{" "}
              {["PDF", "DOCX", "DOC", "PPTX", "GSLIDES", "PAGES", "TXT", "RTF"].map(
                (f, i, arr) => (
                  <span key={f}>
                    <span className="font-mono text-[#F0EDE8]">{f}</span>
                    {i < arr.length - 1 ? ", " : ""}
                  </span>
                )
              )}
            </p>
          </section>

          {/* Built For */}
          <section className="mb-16">
            <h2 className="mb-6 font-display text-2xl font-bold text-white">
              Built For
            </h2>
            <div className="space-y-4">
              {builtFor.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-6"
                >
                  <h3 className="mb-2 text-sm font-medium text-[#F0EDE8]">
                    {item.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-[#888480]">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Bottom CTA */}
          <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-10 text-center">
            <h2 className="font-display text-2xl font-bold text-white">
              Get Early Access
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#888480]">
              The MDSpin API is coming soon. Join the waitlist to be the first to
              integrate document conversion into your workflow.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/#waitlist"
                className="rounded-full bg-[#FF4800] px-6 py-2 text-sm font-semibold text-white transition-all hover:bg-[#e04200]"
              >
                Join the waitlist
              </Link>
              <Link
                href="/#converter"
                className="rounded-full border border-[#2A2A2A] px-6 py-2 text-sm font-medium text-[#888480] transition-colors hover:border-[#3A3A3A] hover:text-white"
              >
                Try the web app
              </Link>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
