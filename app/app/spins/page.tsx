"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Copy, Download, Trash2, Check, FileText } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase/client"

type Conversion = {
  id: string
  filename: string
  file_type: string
  word_count: number | null
  markdown_text: string | null
  converted_at: string
}

const PAGE = 100

export default function SpinsPage() {
  const { user, isLoading: authLoading } = useAuth()
  const [conversions, setConversions] = useState<Conversion[]>([])
  const [loading, setLoading] = useState(true)
  const [limit, setLimit] = useState(PAGE)
  const [hasMore, setHasMore] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      return
    }

    supabase
      .from("conversions")
      .select("*")
      .order("converted_at", { ascending: false })
      .range(0, limit - 1)
      .then(({ data }) => {
        const rows = data ?? []
        setConversions(rows)
        setHasMore(rows.length === limit)
        setLoading(false)
      })
  }, [user, authLoading, limit])

  const handleCopy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDownload = (filename: string, text: string) => {
    const blob = new Blob([text], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename.replace(/\.[^/.]+$/, "") + ".md"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDelete = async (id: string) => {
    await supabase.from("conversions").delete().eq("id", id)
    setConversions((prev) => prev.filter((c) => c.id !== id))
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <svg className="h-6 w-6 animate-spin text-[#FF4800]" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#F0EDE8] font-[family-name:var(--font-syne)]">My Spins</h1>
        <p className="text-sm text-[#888480] font-[family-name:var(--font-dm-sans)]">
          {conversions.length} conversion{conversions.length !== 1 ? "s" : ""}
        </p>
      </div>

      {conversions.length === 0 ? (
        <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-[#4A4A46] mb-3" />
          <p className="text-sm text-[#888480] font-[family-name:var(--font-dm-sans)]">
            No conversions yet. Go spin some docs!
          </p>
          <Link
            href="/app"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#FF4800] px-5 py-2 text-sm font-semibold text-white hover:bg-[#e04200] transition-colors"
          >
            Convert a file
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {conversions.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-4 transition-colors hover:border-[#3A3A3A]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-[#F0EDE8]">{c.filename}</p>
                      <span className="shrink-0 rounded-full border border-[#2A2A2A] px-2 py-0.5 font-mono text-[10px] uppercase text-[#4A4A46]">
                        {c.file_type}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-[#4A4A46]">
                      <span>{formatDate(c.converted_at)}</span>
                      {c.word_count != null && <span>{c.word_count.toLocaleString()} words</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {c.markdown_text && (
                      <>
                        <button
                          onClick={() => handleCopy(c.id, c.markdown_text!)}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-[#2A2A2A] text-[#4A4A46] hover:border-[#4A4A46] hover:text-[#F0EDE8] transition-colors"
                          title="Copy markdown"
                        >
                          {copiedId === c.id ? (
                            <Check className="h-3.5 w-3.5 text-[#FF4800]" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDownload(c.filename, c.markdown_text!)}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-[#2A2A2A] text-[#4A4A46] hover:border-[#4A4A46] hover:text-[#F0EDE8] transition-colors"
                          title="Download .md"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-[#2A2A2A] text-[#4A4A46] hover:border-red-500/30 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => setLimit((n) => n + PAGE)}
                className="rounded-full border border-[#2A2A2A] px-6 py-2 text-sm text-[#888480] hover:text-[#F0EDE8] hover:border-[#4A4A46] transition-colors"
              >
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
