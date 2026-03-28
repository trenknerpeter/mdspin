import Link from "next/link"
import { ArrowRight } from "lucide-react"

interface ContentNavProps {
  section: string
  href: string
}

export function ContentNav({ section, href }: ContentNavProps) {
  return (
    <nav className="fixed left-0 right-0 top-0 z-40 border-b border-[#1E1E1E] bg-[#0C0C0C]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="MDSpin" className="h-7 w-7 rounded-md" />
            <span className="font-display text-sm font-semibold tracking-tight text-white">
              MDSpin
            </span>
          </Link>
          <span className="text-[#2A2A2A]">/</span>
          <Link
            href={href}
            className="text-sm font-medium text-[#F0EDE8] transition-colors hover:text-white"
          >
            {section}
          </Link>
        </div>
        <Link
          href="/#converter"
          className="flex items-center gap-1.5 rounded-full bg-[#FF4800] px-4 py-1.5 text-xs font-semibold text-white transition-all hover:bg-[#e04200]"
        >
          Try it <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </nav>
  )
}
