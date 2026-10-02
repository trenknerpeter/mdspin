import Link from "next/link"
import type { Metadata } from "next"
import { Check } from "lucide-react"
import { SITE_URL, SITE_NAME } from "@/lib/seo"
import { SiteNav } from "@/components/site-nav"
import { SiteFooter } from "@/components/site-footer"
import { GrainOverlay } from "@/components/grain-overlay"
import { ProWaitlistButton } from "@/components/pricing/pro-waitlist-button"

export const metadata: Metadata = {
  title: "Pricing — Free Document to Markdown Conversion",
  description:
    "MDSpin is free: preview conversions without an account, or sign up free for 10 conversions a day and your Knowledge Vault. Pro is coming soon.",
  alternates: { canonical: `${SITE_URL}/pricing` },
  openGraph: {
    title: "Pricing — Free Document to Markdown Conversion | MDSpin",
    description:
      "MDSpin is free: preview conversions without an account, or sign up free for 10 conversions a day and your Knowledge Vault. Pro is coming soon.",
    url: `${SITE_URL}/pricing`,
  },
}

const freeFeatures = [
  "Preview conversions without an account",
  "10 conversions a day with a free account",
  "PDF, DOCX, PPTX, images and more",
  "URL & batch conversion (up to 10 files)",
  "Knowledge Vault: projects, tags, search and map",
  "Chrome browser extension",
]

const proFeatures = [
  "Higher daily conversion limits",
  "Bigger files and larger batches",
  "Unlimited AI summaries, briefs and auto-filing",
]

const faqs = [
  {
    q: "Is MDSpin really free?",
    a: "Yes. Without an account you can convert a file and preview the result. A free account unlocks the full document, 10 conversions a day, URL and batch conversion, and the Knowledge Vault. No credit card.",
  },
  {
    q: "Why do I need an account to get the full result?",
    a: "It keeps MDSpin free and abuse-free, and it means your conversions are saved to your Vault so you can find them again later.",
  },
  {
    q: "Why the daily limit?",
    a: "To keep the service fast and free for everyone. If you need more, join the Pro waitlist.",
  },
  {
    q: "When is Pro launching?",
    a: "When enough people ask for it. Click “Notify me” and we’ll email you once, when it’s ready — no newsletter.",
  },
]

export default function PricingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Pricing — MDSpin",
    description:
      "MDSpin is free: preview conversions without an account, or sign up free for 10 conversions a day and your Knowledge Vault. Pro is coming soon.",
    url: `${SITE_URL}/pricing`,
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  }

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Pricing" },
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
        <div className="mx-auto max-w-5xl px-6">
          {/* Header */}
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#FF4800]">
              Pricing
            </p>
            <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
              Simple, transparent pricing
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-[#888480]">
              MDSpin is free to use. No credit card required, no hidden fees.
            </p>
          </div>

          {/* Cards */}
          <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
            {/* Free */}
            <div className="flex flex-col rounded-xl border border-[#FF4800]/30 bg-[#161616] p-8">
              {/* Intentionally hardcoded: this is a server component with no auth state.
                  Free is the only plan currently available so this is accurate for all users. */}
              <span className="inline-block w-fit rounded-full bg-[#FF4800]/15 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#FF4800]">
                Current plan
              </span>
              <div className="mt-5">
                <span className="font-display text-4xl font-bold text-white">$0</span>
                <span className="ml-1 text-sm text-[#888480]">/month</span>
              </div>
              <p className="mt-1 text-sm text-[#888480]">Free forever</p>

              <ul className="mt-8 space-y-3">
                {freeFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-[#888480]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#FF4800]" />
                    {f}
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-8">
                <Link
                  href="/#converter"
                  className="flex items-center justify-center rounded-full bg-[#FF4800] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#e04200]"
                >
                  Get started
                </Link>
              </div>
            </div>

            {/* Pro - Coming Soon */}
            <div className="flex flex-col rounded-xl border border-[#2A2A2A] bg-[#161616] p-8">
              <span className="inline-block rounded-full border border-[#2A2A2A] px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#4A4A46]">
                Coming soon
              </span>
              <div className="mt-5">
                <span className="font-display text-4xl font-bold text-white">Pro</span>
              </div>
              <p className="mt-1 text-sm text-[#888480]">For power users</p>

              <ul className="mt-8 space-y-3">
                {proFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-[#888480]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#FF4800]" />
                    {f}
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-8"><ProWaitlistButton /></div>
            </div>
          </div>

          {/* FAQ */}
          <div className="mt-24">
            <h2 className="mb-10 text-center font-display text-2xl font-bold text-white">
              Frequently asked questions
            </h2>
            <div className="mx-auto max-w-2xl space-y-8">
              {faqs.map((faq) => (
                <div key={faq.q}>
                  <h3 className="text-sm font-semibold text-white">{faq.q}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#888480]">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
