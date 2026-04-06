"use client"

import Link from "next/link"
import { useState } from "react"

function BuyCoffeeLink() {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch("/api/checkout", { method: "POST" })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="text-xs text-[#4A4A46] transition-colors hover:text-[#888480] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Redirecting…" : "Buy coffee ☕"}
    </button>
  )
}

const productLinks = [
  { href: "/overview", label: "Overview" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/formats", label: "Formats" },
  { href: "/developer-api", label: "API" },
  { href: "/integrations", label: "Integrations" },
]

const resourceLinks = [
  { href: "/guides", label: "Guides" },
  { href: "/blog", label: "Blog" },
  { href: "/use-cases", label: "Use Cases" },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-[#1E1E1E] py-10">
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="MDSpin" className="h-6 w-6 rounded-md opacity-50" />
              <span className="text-xs text-[#4A4A46]">MDSpin</span>
            </div>
            <p className="mt-3 text-xs text-[#4A4A46]">
              Drop, spin, done. &copy; {new Date().getFullYear()}
            </p>
          </div>

          {/* Product */}
          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[#888480]">
              Product
            </p>
            <div className="flex flex-col gap-2">
              {productLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-xs text-[#4A4A46] transition-colors hover:text-[#888480]"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Resources */}
          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[#888480]">
              Resources
            </p>
            <div className="flex flex-col gap-2">
              {resourceLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-xs text-[#4A4A46] transition-colors hover:text-[#888480]"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Company */}
          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[#888480]">
              Company
            </p>
            <div className="flex flex-col gap-2">
              <Link href="/privacy" className="text-xs text-[#4A4A46] transition-colors hover:text-[#888480]">
                Privacy
              </Link>
              <Link href="https://github.com/trenknerpeter/mdspin" target="_blank" rel="noopener noreferrer" className="text-xs text-[#4A4A46] transition-colors hover:text-[#888480]">
                GitHub
              </Link>
              <BuyCoffeeLink />
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
