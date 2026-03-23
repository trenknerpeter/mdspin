import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import type { Metadata } from "next"
import { getAllSlugs, getPostBySlug, markdownToHtml } from "@/lib/blog"
import { SITE_URL, SITE_NAME } from "@/lib/seo"
import { BlogNav } from "@/components/blog-nav"

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

  return (
    <div className="min-h-screen bg-[#0C0C0C] font-sans text-[#F0EDE8]">
      {/* Grain overlay */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        }}
      />

      <BlogNav />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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

      {/* Footer */}
      <footer className="border-t border-[#1E1E1E] py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="MDSpin" className="h-6 w-6 rounded-md opacity-50" />
            <span className="text-xs text-[#4A4A46]">MDSpin</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/blog" className="text-xs text-[#4A4A46] transition-colors hover:text-[#888480]">
              Blog
            </Link>
            <Link href="/privacy" className="text-xs text-[#4A4A46] transition-colors hover:text-[#888480]">
              Privacy
            </Link>
            <p className="text-xs text-[#4A4A46]">
              Drop, spin, done. &copy; {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
