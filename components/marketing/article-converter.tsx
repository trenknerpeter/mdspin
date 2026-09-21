import { ConvertPageConverter } from "./convert-page-converter"

/**
 * The converter, embedded at the end of a guide or blog post.
 *
 * Why this exists: organic search brings ~4,900 sessions a quarter to
 * /blog and /guides, and before this those templates had no converter and no
 * CTA to one — 1.6% of those sessions ever reached a page with a converter on
 * it, against 83% for the homepage. The tool was one click further away than
 * anyone was willing to go.
 *
 * Reuses the same client island as /convert/[slug], so the anonymous quota,
 * the sign-in wall and the existing analytics all behave identically. Events
 * carry $pathname, so conversions started from an article are already
 * distinguishable in the "Where conversions start" insight — no extra
 * instrumentation needed.
 *
 * `-mx-6` cancels the px-6 of the enclosing <article>; Converter applies its
 * own `mx-auto max-w-2xl px-6`, so without this the padding would double and
 * the tool would sit narrower than the text above it.
 */
export function ArticleConverter({ heading, subheading }: {
  heading?: string
  subheading?: string
} = {}) {
  return (
    <section className="-mx-6 mt-16 border-t border-[#1E1E1E] pt-12">
      <ConvertPageConverter
        eyebrow="Try it free"
        heading={heading ?? "Convert a document to Markdown"}
        subheading={
          subheading ??
          "Drop in a PDF, Word file, or screenshot — clean Markdown back in seconds. No account needed to try it."
        }
      />
    </section>
  )
}
