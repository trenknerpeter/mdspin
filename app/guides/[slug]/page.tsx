import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import type { Metadata } from "next"
import {
  getAllGuideSlugs,
  getAllGuides,
  getGuideBySlug,
  guideMarkdownToHtml,
} from "@/lib/guides"
import { SITE_URL, SITE_NAME } from "@/lib/seo"
import { SiteNav } from "@/components/site-nav"
import { SiteFooter } from "@/components/site-footer"
import { GrainOverlay } from "@/components/grain-overlay"

type Props = { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  return getAllGuideSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const guide = getGuideBySlug(slug)
  if (!guide) return {}

  return {
    title: guide.title,
    description: guide.description,
    authors: [{ name: guide.author }],
    openGraph: {
      type: "article",
      title: guide.title,
      description: guide.description,
      url: `${SITE_URL}/guides/${slug}`,
      publishedTime: guide.date,
      authors: [guide.author],
    },
    twitter: {
      card: "summary_large_image",
      title: guide.title,
      description: guide.description,
    },
    alternates: {
      canonical: `${SITE_URL}/guides/${slug}`,
    },
  }
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params
  const guide = getGuideBySlug(slug)
  if (!guide) notFound()

  const html = await guideMarkdownToHtml(guide.content)

  // Get other guides for internal linking
  const allGuides = getAllGuides().filter((g) => g.slug !== slug)

  // Use HowTo for step-by-step guides, Article for informational ones
  const isHowTo = ["convert-pdf-for-chatgpt", "reduce-ai-token-costs"].includes(slug)

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": isHowTo ? ["Article", "HowTo"] : "Article",
    headline: guide.title,
    description: guide.description,
    datePublished: guide.date,
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    url: `${SITE_URL}/guides/${slug}`,
    mainEntityOfPage: `${SITE_URL}/guides/${slug}`,
  }

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE_URL}/guides` },
      { "@type": "ListItem", position: 3, name: guide.title },
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
        <article className="mx-auto max-w-2xl px-6">
          {/* Back link */}
          <Link
            href="/guides"
            className="mb-10 inline-flex items-center gap-1.5 text-sm text-[#4A4A46] transition-colors hover:text-[#888480]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All guides
          </Link>

          {/* Header */}
          <header className="mb-12">
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

            <h1 className="font-display text-3xl font-extrabold leading-tight text-white sm:text-4xl">
              {guide.title}
            </h1>

            <div className="mt-4 flex items-center gap-3 text-sm text-[#888480]">
              <span>{guide.author}</span>
              <span className="h-0.5 w-0.5 rounded-full bg-[#4A4A46]" />
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
          </header>

          {/* Body */}
          <div
            className="prose-blog"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          {/* Related Guides */}
          {allGuides.length > 0 && (
            <div className="mt-16 border-t border-[#1E1E1E] pt-8">
              <h2 className="mb-6 font-display text-lg font-semibold text-white">
                More guides
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {allGuides.slice(0, 3).map((g) => (
                  <Link
                    key={g.slug}
                    href={`/guides/${g.slug}`}
                    className="group rounded-lg border border-[#2A2A2A] bg-[#161616] p-5 transition-colors hover:border-[#3A3A3A]"
                  >
                    <h3 className="text-sm font-semibold text-[#F0EDE8] transition-colors group-hover:text-white">
                      {g.title}
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-[#888480]">
                      {g.description}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Related Blog Posts */}
          <div className="mt-10 border-t border-[#1E1E1E] pt-8">
            <p className="text-sm text-[#888480]">
              Want more? Check out the{" "}
              <Link
                href="/blog"
                className="text-[#FF4800] transition-colors hover:text-[#e04200]"
              >
                MDSpin blog
              </Link>{" "}
              for deep dives on AI document processing.
            </p>
          </div>

          {/* Back link */}
          <div className="mt-8 border-t border-[#1E1E1E] pt-8">
            <Link
              href="/guides"
              className="inline-flex items-center gap-1.5 text-sm text-[#4A4A46] transition-colors hover:text-[#888480]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to all guides
            </Link>
          </div>
        </article>
      </main>

      <SiteFooter />
    </div>
  )
}
