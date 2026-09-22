import { ArrowDown } from "lucide-react"
import { ARTICLE_CONVERTER_ID } from "./article-converter"

/**
 * A compact prompt part-way through a guide or blog post, pointing at the
 * converter embedded at the foot of the same page.
 *
 * The converter at the end only reaches people who finish reading, and
 * 95–99% of these sessions are a single page with little dwell. This catches
 * the rest without interrupting the article: one line, no form, no images.
 *
 * Deliberately a plain anchor rather than a button with a scroll handler — it
 * needs no JavaScript, works before hydration, and costs nothing in bundle
 * size on pages whose whole job is ranking in search.
 */
export function ArticleCtaBar() {
  return (
    <aside className="my-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#2A2A2A] bg-[#131313] px-5 py-4">
      <p className="text-sm text-[#888480]">
        Got a document to convert?{" "}
        <span className="text-[#F0EDE8]">Try it free on this page</span> — no account needed.
      </p>
      <a
        href={`#${ARTICLE_CONVERTER_ID}`}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#FF4800] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#e04200]"
      >
        Convert a file
        <ArrowDown className="h-3.5 w-3.5" />
      </a>
    </aside>
  )
}
