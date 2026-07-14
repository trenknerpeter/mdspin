import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { SITE_URL, SITE_NAME } from "@/lib/seo"
import { CONVERT_PAGES, getConvertPage } from "@/lib/convert-pages"
import { SiteNav } from "@/components/site-nav"
import { SiteFooter } from "@/components/site-footer"
import { GrainOverlay } from "@/components/grain-overlay"
import { ConvertPageConverter } from "@/components/marketing/convert-page-converter"

export function generateStaticParams() {
  return CONVERT_PAGES.map((page) => ({ slug: page.slug }))
}

export async function generateMetadata({ params }: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const page = getConvertPage(slug)
  if (!page) return {}

  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: `${SITE_URL}/convert/${page.slug}` },
    openGraph: {
      title: `${page.metaTitle} | ${SITE_NAME}`,
      description: page.metaDescription,
      url: `${SITE_URL}/convert/${page.slug}`,
    },
  }
}

export default async function ConvertPage({ params }: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const page = getConvertPage(slug)
  if (!page) notFound()

  const url = `${SITE_URL}/convert/${page.slug}`

  const webAppLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: page.h1,
    url,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web",
    description: page.metaDescription,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  }

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  }

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Convert", item: `${SITE_URL}/formats` },
      { "@type": "ListItem", position: 3, name: page.h1 },
    ],
  }

  return (
    <div className="min-h-screen bg-[#0C0C0C] font-sans text-[#F0EDE8]">
      <GrainOverlay />
      <SiteNav />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      <main className="pb-24 pt-32">
        {/* Header — direct answer first */}
        <div className="mx-auto max-w-3xl px-6 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#FF4800]">
            {page.eyebrow}
          </p>
          <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
            {page.h1}
          </h1>
          <div className="mx-auto mt-6 max-w-2xl space-y-4 text-left">
            {page.intro.map((paragraph) => (
              <p key={paragraph.slice(0, 32)} className="text-sm leading-relaxed text-[#888480]">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        {/* The tool */}
        <section className="mt-16">
          <ConvertPageConverter
            eyebrow={page.converterEyebrow}
            heading={page.converterHeading}
            subheading={page.converterSubheading}
          />
        </section>

        <div className="mx-auto max-w-3xl px-6">
          {/* How it works */}
          <section className="mt-20">
            <h2 className="font-display text-2xl font-bold text-white">
              How it works
            </h2>
            <ol className="mt-6 space-y-6">
              {page.steps.map((step, i) => (
                <li key={step.title} className="flex items-start gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF4800]/15 font-mono text-sm font-semibold text-[#FF4800]">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-[#888480]">
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Content sections */}
          {page.sections.map((section) => (
            <section key={section.heading} className="mt-16">
              <h2 className="font-display text-2xl font-bold text-white">
                {section.heading}
              </h2>
              {section.paragraphs.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 32)}
                  className="mt-4 text-sm leading-relaxed text-[#888480]"
                >
                  {paragraph}
                </p>
              ))}
              {section.bullets && (
                <ul className="mt-4 space-y-2">
                  {section.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="flex items-start gap-2 text-sm text-[#888480]"
                    >
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#FF4800]" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          {/* FAQ */}
          <section className="mt-16">
            <h2 className="font-display text-2xl font-bold text-white">
              Frequently asked questions
            </h2>
            <div className="mt-6 space-y-8">
              {page.faqs.map((faq) => (
                <div key={faq.question}>
                  <h3 className="text-sm font-semibold text-white">{faq.question}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#888480]">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Related */}
          <section className="mt-16">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#4A4A46]">
              Keep reading
            </h2>
            <ul className="space-y-2">
              {page.related.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-[#FF4800] transition-colors hover:text-[#e04200]"
                  >
                    {link.label} →
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
