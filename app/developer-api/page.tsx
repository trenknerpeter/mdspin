import type { Metadata } from "next"
import { SITE_URL, SITE_NAME } from "@/lib/seo"
import { SiteNav } from "@/components/site-nav"
import { SiteFooter } from "@/components/site-footer"
import { GrainOverlay } from "@/components/grain-overlay"
import { ApiDocsContent } from "./api-docs-content"

export const metadata: Metadata = {
  title: "API Reference — MDSpin Developer Documentation",
  description:
    "Complete API reference for MDSpin. Convert PDF, DOCX, Google Docs, and Google Slides to clean Markdown programmatically. Authentication, endpoints, parameters, and examples.",
  alternates: { canonical: `${SITE_URL}/developer-api` },
  openGraph: {
    title: "API Reference — MDSpin Developer Documentation",
    description:
      "Complete API reference for MDSpin. Convert documents to clean Markdown programmatically.",
    url: `${SITE_URL}/developer-api`,
  },
}

export default function DeveloperApiPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    name: "MDSpin API Reference",
    description:
      "Complete API reference for converting documents to Markdown with MDSpin.",
    url: `${SITE_URL}/developer-api`,
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  }

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: "API Reference",
        item: `${SITE_URL}/developer-api`,
      },
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
              API Reference
            </p>
            <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
              Developer API
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-[#888480]">
              Programmatic access to MDSpin&apos;s conversion engine. Convert PDF,
              DOCX, Google Docs, Google Slides, and more to clean Markdown.
            </p>
          </div>

          <ApiDocsContent />
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
