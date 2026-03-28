import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="border-t border-[#1E1E1E] py-10">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="MDSpin" className="h-6 w-6 rounded-md opacity-50" />
          <span className="text-xs text-[#4A4A46]">MDSpin</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/guides" className="text-xs text-[#4A4A46] transition-colors hover:text-[#888480]">
            Guides
          </Link>
          <Link href="/formats" className="text-xs text-[#4A4A46] transition-colors hover:text-[#888480]">
            Formats
          </Link>
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
  )
}
