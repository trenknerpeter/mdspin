import Link from "next/link"
import { getAllPosts } from "@/lib/blog"
import { BlogNav } from "@/components/blog-nav"

export default function BlogPage() {
  const posts = getAllPosts()

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
