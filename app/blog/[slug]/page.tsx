import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import type { Metadata } from "next"
import { getAllSlugs, getPostBySlug, markdownToHtml } from "@/lib/blog"
import { SITE_URL, SITE_NAME } from "@/lib/seo"
import { ContentNav } from "@/components/content-nav"
import { SiteFooter } from "@/components/site-footer"
import { GrainOverlay } from "@/components/grain-overlay"

type Props = { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) return {}

  return {
    title: post.title,
    description: post.description,
    authors: [{ name: post.author }],
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url: `${SITE_URL}/blog/${slug}`,
      publishedTime: post.date,
      authors: [post.author],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
    alternates: {
      canonical: `${SITE_URL}/blog/${slug}`,
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) notFound()

  const html = await markdownToHtml(post.content)

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: { "@type": "Person", name: post.author },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    url: `${SITE_URL}/blog/${slug}`,
    image: `${SITE_URL}/blog/${slug}/opengraph-image`,
  }

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
      { "@type": "ListItem", position: 3, name: post.title },
    ],
  }

  return (
    <div className="min-h-screen bg-[#0C0C0C] font-sans text-[#F0EDE8]">
      <GrainOverlay />
      <ContentNav section="Blog" href="/blog" />

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
            href="/blog"
            className="mb-10 inline-flex items-center gap-1.5 text-sm text-[#4A4A46] transition-colors hover:text-[#888480]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All posts
          </Link>

          {/* Header */}
          <header className="mb-12">
            {post.tags.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
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
              {post.title}
            </h1>

            <div className="mt-4 flex items-center gap-3 text-sm text-[#888480]">
              <span>{post.author}</span>
              <span className="h-0.5 w-0.5 rounded-full bg-[#4A4A46]" />
              <time dateTime={post.date}>
                {new Date(post.date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
              <span className="h-0.5 w-0.5 rounded-full bg-[#4A4A46]" />
              <span>{post.readingTime} min read</span>
            </div>
          </header>

          {/* Body */}
          <div
            className="prose-blog"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          {/* Back link */}
          <div className="mt-16 border-t border-[#1E1E1E] pt-8">
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-sm text-[#4A4A46] transition-colors hover:text-[#888480]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to all posts
            </Link>
          </div>
        </article>
      </main>

      <SiteFooter />
    </div>
  )
}
