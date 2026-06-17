"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { Copy, Download, Trash2, Check, FileText, Search, BookmarkPlus, BookmarkCheck } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { listHistory, deleteSpin, addToVault, type Spin } from "@/lib/library"

const PAGE = 100

export default function HistoryPage() {
  const { user, isLoading: authLoading } = useAuth()
  const [rows, setRows] = useState<Spin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [limit, setLimit] = useState(PAGE)
  const [hasMore, setHasMore] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])
  useEffect(() => setLimit(PAGE), [query])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listHistory({ query, from: 0, to: limit - 1 })
      setRows(data)
      setHasMore(data.length === limit)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load history")
    } finally {
      setLoading(false)
    }
  }, [query, limit])

  useEffect(() => {
    if (authLoading) return
    if (!user) { setLoading(false); return }
    load()
  }, [user, authLoading, load])

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

  const handleCopy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }
  const handleDownload = (name: string, text: string) => {
    const blob = new Blob([text], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = name.replace(/\.[^/.]+$/, "") + ".md"
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
  const handleDelete = async (id: string) => {
    await deleteSpin(id)
    setRows((prev) => prev.filter((r) => r.id !== id))
  }
  const handleAddToVault = async (id: string) => {
    // No opts → flips in_vault only, preserving any existing project/tags.
    await addToVault([id])
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, in_vault: true } : r)))
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
        <h1 className="font-[family-name:var(--font-syne)] text-2xl font-bold text-[#F0EDE8]">History</h1>
        <p className="font-[family-name:var(--font-dm-sans)] text-sm text-[#888480]">
          Everything you&apos;ve converted
        </p>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4A4A46]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search filenames and content…"
          className="w-full rounded-xl border border-[#2A2A2A] bg-[#161616] py-2.5 pl-10 pr-4 text-sm text-[#F0EDE8] placeholder:text-[#4A4A46] focus:border-[#4A4A46] focus:outline-none"
        />
      </div>

      {error ? (
        <div className="rounded-xl border border-[#FF4800]/30 bg-[#161616] p-12 text-center">
          <p className="text-sm text-[#FF4800]">Couldn&apos;t load history: {error}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-12 text-center">
          <FileText className="mx-auto mb-3 h-8 w-8 text-[#4A4A46]" />
          <p className="text-sm text-[#888480]">No conversions yet. Go spin some docs!</p>
          <Link href="/app" className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#FF4800] px-5 py-2 text-sm font-semibold text-white hover:bg-[#e04200]">
            Convert a file
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {rows.map((c) => (
              <div key={c.id} className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#F0EDE8]">{c.title || c.filename}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-[#4A4A46]">
                      <span>{formatDate(c.converted_at)}</span>
                      {c.word_count != null && <span>{c.word_count.toLocaleString()} words</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {c.in_vault ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-[#FF4800]/30 px-2 py-1 text-[10px] font-medium text-[#FF4800]">
                        <BookmarkCheck className="h-3.5 w-3.5" /> In Vault
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAddToVault(c.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-[#2A2A2A] px-2 py-1 text-[10px] font-medium text-[#888480] transition-colors hover:border-[#FF4800]/40 hover:text-[#FF4800]"
                        title="Add to Vault"
                      >
                        <BookmarkPlus className="h-3.5 w-3.5" /> Add to Vault
                      </button>
                    )}
                    {c.markdown_text && (
                      <>
                        <button onClick={() => handleCopy(c.id, c.markdown_text!)} className="flex h-7 w-7 items-center justify-center rounded-md border border-[#2A2A2A] text-[#4A4A46] hover:border-[#4A4A46] hover:text-[#F0EDE8]" title="Copy markdown">
                          {copiedId === c.id ? <Check className="h-3.5 w-3.5 text-[#FF4800]" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                        <button onClick={() => handleDownload(c.filename, c.markdown_text!)} className="flex h-7 w-7 items-center justify-center rounded-md border border-[#2A2A2A] text-[#4A4A46] hover:border-[#4A4A46] hover:text-[#F0EDE8]" title="Download .md">
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    <button onClick={() => handleDelete(c.id)} className="flex h-7 w-7 items-center justify-center rounded-md border border-[#2A2A2A] text-[#4A4A46] hover:border-red-500/30 hover:text-red-400" title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {hasMore && (
            <div className="mt-6 flex justify-center">
              <button onClick={() => setLimit((n) => n + PAGE)} className="rounded-full border border-[#2A2A2A] px-6 py-2 text-sm text-[#888480] hover:border-[#4A4A46] hover:text-[#F0EDE8]">
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
