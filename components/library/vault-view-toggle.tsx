"use client"

import Link from "next/link"
import { LayoutGrid, List, Share2 } from "lucide-react"

// Segmented Folders / List / Map switch shared by the Vault views and the Knowledge Map.
export function VaultViewToggle({ active }: { active: "folders" | "list" | "map" }) {
  const base =
    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
  const on = "bg-[#2A2A2A] text-[#F0EDE8]"
  const off = "text-[#888480] hover:text-[#F0EDE8]"
  return (
    <div className="inline-flex rounded-lg border border-[#2A2A2A] bg-[#161616] p-0.5">
      <Link href="/app/vault" className={`${base} ${active === "folders" ? on : off}`}>
        <LayoutGrid className="h-3.5 w-3.5" /> Folders
      </Link>
      <Link href="/app/vault?view=list" className={`${base} ${active === "list" ? on : off}`}>
        <List className="h-3.5 w-3.5" /> List
      </Link>
      <Link href="/app/vault/map" className={`${base} ${active === "map" ? on : off}`}>
        <Share2 className="h-3.5 w-3.5" /> Map
      </Link>
    </div>
  )
}
