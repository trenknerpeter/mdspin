"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { VaultIngestPanel } from "@/components/vault/vault-ingest-panel"

export default function VaultAddPage() {
  // window.location (not useSearchParams) is intentional, matching the vault
  // page's own convention: this runs client-side only in a mount effect, so it
  // needs no Suspense boundary and has no SSR/hydration concern.
  const [initialTab, setInitialTab] = useState<"files" | "folder" | "paste">("files")

  useEffect(() => {
    const mode = new URLSearchParams(window.location.search).get("mode")
    if (mode === "folder" || mode === "paste") setInitialTab(mode)
  }, [])

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <Link
          href="/app/vault"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-[#888480] transition-colors hover:text-[#F0EDE8]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Vault
        </Link>
        <h1 className="font-display text-2xl font-bold text-[#F0EDE8]">
          Add to your Vault
        </h1>
        <p className="font-sans text-sm text-[#888480]">
          Upload markdown files, import a folder, or paste text directly.
        </p>
      </div>
      <VaultIngestPanel initialTab={initialTab} />
    </div>
  )
}
