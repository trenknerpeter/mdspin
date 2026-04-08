import Link from "next/link"
import type { Metadata } from "next"
import { Check } from "lucide-react"
import { SITE_URL, SITE_NAME } from "@/lib/seo"
import { SiteNav } from "@/components/site-nav"
import { SiteFooter } from "@/components/site-footer"
import { GrainOverlay } from "@/components/grain-overlay"
import { BuyCoffee } from "@/components/buy-coffee"

export const metadata: Metadata = {
  title: "Pricing — Free Document to Markdown Conversion",
  description:
    "MDSpin is free to use with generous daily limits. See what's included, support the project, and learn about upcoming Pro features.",
  alternates: { canonical: `${SITE_URL}/pricing` },
  openGraph: {
    title: "Pricing — Free Document to Markdown Conversion | MDSpin",
    description:
      "MDSpin is free to use with generous daily limits. See what's included, support the project, and learn about upcoming Pro features.",
    url: `${SITE_URL}/pricing`,
  },
}

const freeFeatures = [
  "3 conversions per day (guest)",
  "20 conversions per day (signed in)",
  "PDF, DOCX, PPTX support",
  "AI-ready Markdown output",
  "Chrome browser extension",
]

const proFeatures = [
  "1,000 conversions per month",
  "Priority processing",
  "More formats coming",
]

const faqs = [
  {
    q: "Is MDSpin really free?",
    a: "Yes — MDSpin is completely free. Guests get 3 conversions per day, and signed-in users get 20 per day. No credit card, no trial, no hidden fees.",
  },
  {
    q: "Why the daily limit?",
    a: "To keep the service running smoothly for everyone. If you need more capacity, a Pro plan with higher limits is coming soon.",
  },
  {
    q: "What does 'Buy me a coffee' do?",
    a: "It's a one-time tip to support MDSpin's development. You won't get extra features — it's simply a way to say thanks and help keep the project going.",
  },
  {
    q: "When is the Pro plan launching?",
    a: "We're working on it. Stay tuned for updates.",
  },
]

export default function PricingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Pricing — MDSpin",
    description:
      "MDSpin is free to use with generous daily limits. See what's included and support the project.",
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
          <div className="grid gap-6 md:grid-cols-3">
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

            {/* Support */}
            <div className="flex flex-col rounded-xl border border-[#2A2A2A] bg-[#161616] p-8">
              <span className="text-lg">☕</span>
              <div className="mt-4">
                <span className="font-display text-4xl font-bold text-white">$2.99</span>
                <span className="ml-1 text-sm text-[#888480]">one-time</span>
              </div>
              <p className="mt-1 text-sm text-[#888480]">Buy me a coffee</p>

              <p className="mt-8 text-sm leading-relaxed text-[#888480]">
                I built MDSpin as a solo project and keep it free because I believe
                good tools should be accessible. Your support helps cover server costs
                and keeps development going. No extra features — just a way to say thanks.
              </p>

              <div className="mt-auto pt-8">
                <BuyCoffee fullWidth />
              </div>
            </div>

            {/* Pro - Coming Soon */}
            <div className="flex flex-col rounded-xl border border-[#2A2A2A] bg-[#161616] p-8 opacity-50">
              <span className="inline-block rounded-full border border-[#2A2A2A] px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#4A4A46]">
                Coming soon
              </span>
              <div className="mt-5">
                <span className="font-display text-4xl font-bold text-white">TBD</span>
                <span className="ml-1 text-sm text-[#888480]">/month</span>
              </div>
              <p className="mt-1 text-sm text-[#888480]">For power users</p>

              <ul className="mt-8 space-y-3">
                {proFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-[#4A4A46]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#4A4A46]" />
                    {f}
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-8">
                <button
                  disabled
                  className="flex w-full cursor-not-allowed items-center justify-center rounded-full border border-[#2A2A2A] px-6 py-2.5 text-sm font-medium text-[#4A4A46]"
                >
                  Coming soon
                </button>
              </div>
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
