import Link from "next/link"
import type { Metadata } from "next"
import { getAllPosts } from "@/lib/blog"
import { SiteNav } from "@/components/site-nav"
import { SiteFooter } from "@/components/site-footer"
import { GrainOverlay } from "@/components/grain-overlay"
import { SITE_URL } from "@/lib/seo"

export const metadata: Metadata = {
  title: "Blog — AI Document Processing Insights",
  description:
    "Insights on AI document processing, markdown conversion, and getting more out of your LLM workflows. From the MDSpin team.",
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    title: "Blog — AI Document Processing Insights | MDSpin",
    description:
      "Insights on AI document processing, markdown conversion, and getting more out of your LLM workflows.",
    url: `${SITE_URL}/blog`,
  },
}

export default function BlogPage() {
  const posts = getAllPosts()

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Blog" },
    ],
  }

  return (
    <div className="min-h-screen bg-[#0C0C0C] font-sans text-[#F0EDE8]">
      <GrainOverlay />
      <SiteNav />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      <main className="pb-24 pt-32">
        <div className="mx-auto max-w-4xl px-6">
          {/* Header */}
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#FF4800]">
              Blog
            </p>
            <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
              From the MDSpin team
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-[#888480]">
              Insights on AI document processing, markdown conversion, and getting
              more out of your LLM workflows.
            </p>
          </div>

          {/* Posts grid */}
          {posts.length === 0 ? (
            <p className="text-center text-sm text-[#4A4A46]">
              No posts yet. Check back soon.
            </p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {posts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group rounded-xl border border-[#2A2A2A] bg-[#161616] p-8 transition-colors hover:border-[#3A3A3A]"
                >
                  {/* Tags */}
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

                  <h2 className="font-display text-lg font-semibold text-[#F0EDE8] transition-colors group-hover:text-white">
                    {post.title}
                  </h2>

                  <p className="mt-3 text-sm leading-relaxed text-[#888480]">
                    {post.description}
                  </p>

                  <div className="mt-5 flex items-center gap-3 text-xs text-[#4A4A46]">
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
                </Link>
              ))}

              {/* Coming soon teaser */}
              <div className="relative rounded-xl border border-dashed border-[#2A2A2A] bg-[#0C0C0C] p-8 opacity-60">
                <div className="mb-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-[#F0EDE8]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#F0EDE8]/40">
                    Coming soon
                  </span>
                </div>
                <h2 className="font-display text-lg font-semibold text-[#F0EDE8]/50">
                  What Happens When Your AI Can Spin Its Own Files
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-[#4A4A46]">
                  More details soon.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
