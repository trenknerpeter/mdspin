"use client"

import Link from "next/link"

// Shared row template for the dashboard's two vault lists (Projects rail,
// Recently added to Vault). Same leading swatch, same title zone, same two
// trailing metadata zones in the same order in both — so the two cards read
// as one design component, not two similar-but-different ones. The
// rightmost zone is always a date in both callers; the one before it is
// always a count-shaped number (doc count, or word count).
export function DashboardListRow({
  href,
  color,
  title,
  count,
  date,
}: {
  href: string
  color?: string | null
  title: string
  count?: string
  date?: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[#1A1A1A]"
    >
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-sm"
        style={{ background: color ?? "#4A4A46" }}
      />
      <span className="min-w-0 flex-1 truncate text-sm text-[#F0EDE8]">{title}</span>
      {count && (
        <span className="shrink-0 text-right text-xs text-[#888480]">{count}</span>
      )}
      {date && (
        <span className="shrink-0 text-right text-xs text-[#4A4A46] min-w-[3.5rem]">{date}</span>
      )}
    </Link>
  )
}
