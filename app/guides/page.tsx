import Link from "next/link"
import type { Metadata } from "next"
import { getAllGuides } from "@/lib/guides"
import { ContentNav } from "@/components/content-nav"
import { SiteFooter } from "@/components/site-footer"
import { GrainOverlay } from "@/components/grain-overlay"
import { SITE_URL } from "@/lib/seo"

export const metadata: Metadata = {
  title: "Guides — AI Document Processing Tutorials",
  description:
    "Step-by-step guides for converting documents to markdown, reducing AI token costs, building RAG pipelines, and preprocessing documents for LLMs.",
  alternates: { canonical: `${SITE_URL}/guides` },
  openGraph: {
    title: "Guides — AI Document Processing Tutorials | MDSpin",
    description:
      "Step-by-step guides for converting documents to markdown, reducing AI token costs, building RAG pipelines, and preprocessing documents for LLMs.",
    url: `${SITE_URL}/guides`,
  },
}

export default function GuidesPage() {
  const guides = getAllGuides()

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Guides" },
    ],
  }

  return (
    <div className="min-h-screen bg-[#0C0C0C] font-sans text-[#F0EDE8]">
      <GrainOverlay />
      <ContentNav section="Guides" href="/guides" />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      <main className="pb-24 pt-32">
        <div className="mx-auto max-w-4xl px-6">
          {/* Header */}
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#FF4800]">
              Guides
            </p>
            <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
              AI Document Processing Guides
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-[#888480]">
              Practical tutorials on converting documents for ChatGPT, Claude, and
              Gemini — reduce token costs, improve RAG accuracy, and streamline
              your AI workflows.
            </p>
          </div>

          {/* Guides grid */}
          {guides.length === 0 ? (
            <p className="text-center text-sm text-[#4A4A46]">
              No guides yet. Check back soon.
            </p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {guides.map((guide) => (
                <Link
                  key={guide.slug}
                  href={`/guides/${guide.slug}`}
                  className="group rounded-xl border border-[#2A2A2A] bg-[#161616] p-8 transition-colors hover:border-[#3A3A3A]"
                >
                  {guide.tags.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {guide.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-[#FF4800]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#FF4800]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <h2 className="font-display text-lg font-semibold text-[#F0EDE8] transition-colors group-hover:text-white">
                    {guide.title}
                  </h2>

                  <p className="mt-3 text-sm leading-relaxed text-[#888480]">
                    {guide.description}
                  </p>

                  <div className="mt-5 flex items-center gap-3 text-xs text-[#4A4A46]">
                    <time dateTime={guide.date}>
                      {new Date(guide.date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </time>
                    <span className="h-0.5 w-0.5 rounded-full bg-[#4A4A46]" />
                    <span>{guide.readingTime} min read</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
