import Link from "next/link"
import type { Metadata } from "next"
import { Library, Network, Sparkles, Search, FolderTree, Tags, FileText, GitBranch } from "lucide-react"
import { SITE_URL, SITE_NAME } from "@/lib/seo"
import { SiteNav } from "@/components/site-nav"
import { SiteFooter } from "@/components/site-footer"
import { GrainOverlay } from "@/components/grain-overlay"
import { VaultHeroAnimation } from "@/components/marketing/vault-hero-animation"
import { GetStartedButton } from "@/components/marketing/get-started-button"

export const metadata: Metadata = {
  title: "Knowledge Vault — Organize, Connect & Synthesize Your Documents",
  description:
    "MDSpin's Knowledge Vault keeps every conversion organized, auto-connects related documents into a knowledge map, and synthesizes AI briefs across them — one searchable hub for your AI.",
  alternates: { canonical: `${SITE_URL}/knowledge-vault` },
  openGraph: {
    title: "Knowledge Vault | MDSpin",
    description:
      "Organize every conversion, connect related documents into a knowledge map, and synthesize AI briefs across them.",
    url: `${SITE_URL}/knowledge-vault`,
  },
}

const features = [
  {
    icon: Library,
    label: "Organize",
    title: "Knowledge Vault",
    description:
      "Every file you convert lands in one place instead of your downloads folder. Organize by project, tag freely, and search the full text of everything you've ever converted — your knowledge base grows with every spin.",
    points: [
      { icon: FolderTree, text: "Group documents into color-coded projects" },
      { icon: Tags, text: "Tag freely and filter your vault in a click" },
      { icon: Search, text: "Full-text search across every document" },
      { icon: FileText, text: "Preview, edit, copy, or download clean Markdown" },
    ],
  },
  {
    icon: Network,
    label: "Connect",
    title: "Knowledge Map",
    description:
      "A force-directed graph visualizes your whole vault, auto-clustered by project and connected by content similarity. Find the neighbors of any document, follow a thread across projects, and surface links you'd never spot in a file list.",
    points: [
      { icon: Network, text: "Force-directed graph of your entire vault" },
      { icon: FolderTree, text: "Auto-clustered by project, colored by topic" },
      { icon: GitBranch, text: "Edges drawn from real content similarity" },
      { icon: Search, text: "Click any node to inspect and jump to it" },
    ],
  },
  {
    icon: Sparkles,
    label: "Synthesize",
    title: "Cluster Briefs",
    description:
      "When documents are related, MDSpin can synthesize them. One click sends a cluster to an LLM and returns a brief that pulls the thread across every source — turning a pile of files into an answer you can act on.",
    points: [
      { icon: Sparkles, text: "One-click AI synthesis across related docs" },
      { icon: GitBranch, text: "Automatically gathers the relevant cluster" },
      { icon: FileText, text: "Returns a clean, readable brief in Markdown" },
      { icon: Library, text: "Saved alongside the source in your vault" },
    ],
  },
]

export default function KnowledgeVaultPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Knowledge Vault — MDSpin",
    description:
      "Organize every conversion, connect related documents into a knowledge map, and synthesize AI briefs across them.",
    url: `${SITE_URL}/knowledge-vault`,
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  }

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Knowledge Vault" },
    ],
  }

  return (
    <div className="min-h-screen bg-[#0C0C0C] font-sans text-[#F0EDE8]">
      <GrainOverlay />
      <SiteNav />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      {/* Hero */}
      <section className="relative overflow-hidden pb-24 pt-36">
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-[#FF4800]/8 blur-[140px]" />
        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#FF4800]">
              Knowledge Vault
            </p>
            <h1 className="font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl">
              Where your knowledge lives
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[#888480] lg:mx-0">
              MDSpin doesn&apos;t just convert your files — it keeps them. Organize every
              conversion, let MDSpin connect what&apos;s related, and synthesize briefs across
              your library. One searchable hub your AI can actually use.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <GetStartedButton />
              <Link
                href="/#converter"
                className="inline-flex items-center gap-2 rounded-full border border-[#2A2A2A] px-6 py-2.5 text-sm font-medium text-[#888480] transition-all hover:border-[#4A4A46] hover:text-[#F0EDE8]"
              >
                Try the converter
              </Link>
            </div>
          </div>
          <div className="mt-4 lg:mt-0">
            <VaultHeroAnimation />
          </div>
        </div>
      </section>

      {/* Feature deep-dives */}
      <section className="border-t border-[#1E1E1E] py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-14 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#FF4800]">
              Core features
            </p>
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
              Convert once. Use it forever.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[#888480]">
              Three capabilities turn a one-off conversion into a knowledge hub that compounds
              every time you use it.
            </p>
          </div>

          <div className="space-y-5">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-8 transition-colors hover:border-[#3A3A3A]"
              >
                <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
                  <div>
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#FF4800]/10">
                      <f.icon className="h-6 w-6 text-[#FF4800]" />
                    </div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#4A4A46]">
                      {f.label}
                    </p>
                    <h3 className="font-display text-xl font-semibold text-[#F0EDE8]">{f.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-[#888480]">{f.description}</p>
                  </div>
                  <ul className="grid content-center gap-3">
                    {f.points.map((p) => (
                      <li key={p.text} className="flex items-center gap-3 text-sm text-[#888480]">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#2A2A2A] bg-[#0C0C0C]">
                          <p.icon className="h-4 w-4 text-[#FF4800]" />
                        </span>
                        {p.text}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why it matters */}
      <section className="border-t border-[#1E1E1E] py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#FF4800]">
              Why it matters
            </p>
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
              Your knowledge compounds
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { title: "Nothing gets lost", body: "Every conversion is captured and searchable — no more re-converting the same file or hunting through downloads." },
              { title: "Context gets richer", body: "The more you add, the more connections MDSpin finds, and the better the context you can hand to your AI." },
              { title: "Answers, not files", body: "Cluster briefs turn a stack of related documents into a synthesized answer you can actually use." },
            ].map((b) => (
              <div key={b.title} className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-6">
                <h3 className="font-display text-base font-semibold text-[#F0EDE8]">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#888480]">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-[#1E1E1E] py-24">
        <div className="mx-auto max-w-3xl px-6">
          <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-10 text-center">
            <h2 className="font-display text-2xl font-bold text-white">Start building your vault</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#888480]">
              Convert your first document free and watch it become part of a connected,
              searchable knowledge hub.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <GetStartedButton className="inline-flex items-center gap-2 rounded-full bg-[#FF4800] px-6 py-2 text-sm font-semibold text-white transition-all hover:bg-[#e04200]" />
              <Link
                href="/overview"
                className="rounded-full border border-[#2A2A2A] px-6 py-2 text-sm font-medium text-[#888480] transition-colors hover:border-[#3A3A3A] hover:text-white"
              >
                See how it works
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
