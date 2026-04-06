import Link from "next/link"
import type { Metadata } from "next"
import { SITE_URL, SITE_NAME } from "@/lib/seo"
import { SiteNav } from "@/components/site-nav"
import { SiteFooter } from "@/components/site-footer"
import { GrainOverlay } from "@/components/grain-overlay"

export const metadata: Metadata = {
  title: "Integrations — Make.com Automation for Document Conversion",
  description:
    "Automate document-to-Markdown conversion with MDSpin's Make.com integration. Convert attachments, Google Docs, Google Slides, and URLs to Markdown automatically.",
  alternates: { canonical: `${SITE_URL}/integrations` },
  openGraph: {
    title: "Integrations — Make.com Automation | MDSpin",
    description:
      "Automate document-to-Markdown conversion with MDSpin's Make.com integration.",
    url: `${SITE_URL}/integrations`,
  },
}

const modules = [
  {
    name: "Convert Attachment Batch to Markdown",
    description:
      "Convert multiple email attachments or file uploads to Markdown in a single step.",
  },
  {
    name: "Convert Attachment to Markdown",
    description:
      "Convert a single file attachment from any supported format to clean Markdown.",
  },
  {
    name: "Convert File from URL to Markdown",
    description:
      "Fetch a document from a URL and convert it to structured Markdown.",
  },
  {
    name: "Convert Google Doc to Markdown",
    description:
      "Convert Google Docs directly to Markdown without downloading first.",
  },
  {
    name: "Convert Google Slide to Markdown",
    description:
      "Extract content from Google Slides presentations into readable Markdown.",
  },
  {
    name: "Save Markdown to Google Drive",
    description:
      "Save converted Markdown files directly to a Google Drive folder.",
  },
]

const scenarioSteps = [
  {
    step: "1",
    title: "Trigger",
    description:
      "A new file arrives — email attachment, upload, webhook, or on a schedule.",
  },
  {
    step: "2",
    title: "Convert",
    description:
      "The MDSpin module converts the document to clean, structured Markdown.",
  },
  {
    step: "3",
    title: "Action",
    description:
      "Send the Markdown to your vector store, knowledge base, CRM, or any of 1,500+ connected apps.",
  },
]

export default function IntegrationsPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Integrations — MDSpin",
    description:
      "Automate document-to-Markdown conversion with MDSpin's Make.com integration.",
    url: `${SITE_URL}/integrations`,
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  }

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Integrations" },
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
              Integrations
            </p>
            <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
              Automate Your Document Pipeline
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-[#888480]">
              Connect MDSpin to your existing tools and workflows. Convert documents
              to Markdown automatically as part of your automation pipeline.
            </p>
          </div>

          {/* Make.com */}
          <section className="mb-16">
            <div className="mb-4 flex items-center gap-3">
              <h2 className="font-display text-2xl font-bold text-white">
                Make.com Integration
              </h2>
              <span className="rounded-full bg-yellow-500/15 px-3 py-1 text-xs font-semibold text-yellow-500">
                Coming Soon
              </span>
            </div>
            <p className="text-sm leading-relaxed text-[#888480]">
              Connect MDSpin to 1,500+ apps through Make.com scenarios. Automatically
              convert documents to Markdown as part of your automation workflows —
              triggered by emails, uploads, webhooks, or schedules.
            </p>
          </section>

          {/* Modules */}
          <section className="mb-16">
            <h2 className="mb-6 font-display text-2xl font-bold text-white">
              Available Modules
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {modules.map((mod) => (
                <div
                  key={mod.name}
                  className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-6"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium text-[#F0EDE8]">
                      {mod.name}
                    </h3>
                    <span className="shrink-0 rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-semibold text-yellow-500">
                      In Development
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-[#888480]">
                    {mod.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Scenario Flow */}
          <section className="mb-16">
            <h2 className="mb-6 font-display text-2xl font-bold text-white">
              Scenario Flow
            </h2>
            <div className="space-y-3">
              {scenarioSteps.map((s) => (
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
                    <p className="mt-1 text-xs text-[#888480]">{s.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Request Integration */}
          <section className="mb-16">
            <p className="text-sm text-[#888480]">
              Need MDSpin in a tool we don&apos;t support yet?{" "}
              <Link
                href="https://github.com/trenknerpeter/mdspin/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#FF4800] underline underline-offset-2 transition-colors hover:text-[#FF6633]"
              >
                Let us know on GitHub
              </Link>
              .
            </p>
          </section>

          {/* Bottom CTA */}
          <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-10 text-center">
            <h2 className="font-display text-2xl font-bold text-white">
              Can&apos;t wait for automations?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#888480]">
              Convert your documents now with the MDSpin web app or Chrome extension.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/#converter"
                className="rounded-full bg-[#FF4800] px-6 py-2 text-sm font-semibold text-white transition-all hover:bg-[#e04200]"
              >
                Try MDSpin free
              </Link>
              <Link
                href="/how-it-works"
                className="rounded-full border border-[#2A2A2A] px-6 py-2 text-sm font-medium text-[#888480] transition-colors hover:border-[#3A3A3A] hover:text-white"
              >
                See how it works
              </Link>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
