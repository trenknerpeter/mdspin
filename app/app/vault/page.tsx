"use client"

import Link from "next/link"
import { Search, FileText, Copy, Check, Sparkles } from "lucide-react"
import { useEffect, useState } from "react"
import { useLibrary } from "@/components/library/use-library"
import { LibraryRail } from "@/components/library/library-rail"
import { SpinDetailPanel } from "@/components/library/spin-detail-panel"
import { VaultViewToggle } from "@/components/library/vault-view-toggle"
import { AddToVaultMenu } from "@/components/vault/add-to-vault-menu"
import { EmbeddingBackfillBanner } from "@/components/vault/embedding-backfill-banner"
import { getSpinMarkdown, primaryProjectId, UNFILED } from "@/lib/library"

export default function VaultPage() {
  const lib = useLibrary()
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copyingId, setCopyingId] = useState<string | null>(null)

  useEffect(() => {
    // window.location (not useSearchParams) is intentional: this runs client-side only
    // in a mount effect, so it needs no Suspense boundary and has no SSR/hydration concern.
    const params = new URLSearchParams(window.location.search)
    const id = params.get("spin")
    if (id) lib.openSpin(id).catch(() => {})
    // Dashboard project-rail links land here as ?project=<id> or ?project=unfiled
    // (the readable form of the internal UNFILED sentinel).
    const project = params.get("project")
    if (project) lib.setSelectedProject(project === "unfiled" ? UNFILED : project)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

  // List rows no longer carry markdown_text (SPIN_LIST_FIELDS omits it — a
  // single doc can be 2.4MB), so the row-level copy button fetches on demand.
  const handleCopy = async (id: string) => {
    setCopyingId(id)
    try {
      const text = await getSpinMarkdown(id)
      if (!text) return
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } finally {
      setCopyingId(null)
    }
  }

  const filtersActive = lib.selectedProject !== null || !!lib.selectedTag || lib.search.trim() !== ""
  const clearFilters = () => {
    lib.setSelectedProject(null)
    lib.setSelectedTag(null)
    lib.setSearch("")
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#F0EDE8]">
            Knowledge Vault
          </h1>
          <p className="font-sans text-sm text-[#888480]">
            {lib.stats.total} item{lib.stats.total !== 1 ? "s" : ""} in your Vault
          </p>
        </div>
        <div className="flex items-center gap-2">
          <VaultViewToggle active="list" />
          <AddToVaultMenu onNewNote={() => lib.addNote()} />
        </div>
      </div>

      <div className="flex gap-8">
        <LibraryRail
          projects={lib.projects}
          tags={lib.tags}
          stats={lib.stats}
          selectedProject={lib.selectedProject}
          selectedTag={lib.selectedTag}
          onSelectProject={lib.setSelectedProject}
          onSelectTag={lib.setSelectedTag}
          onCreateProject={lib.addProject}
          onRenameProject={lib.renameProjectById}
          onDeleteProject={lib.removeProject}
        />

        <div className="min-w-0 flex-1">
          <EmbeddingBackfillBanner />

          {/* Search */}
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4A4A46]" />
            <input
              value={lib.search}
              onChange={(e) => lib.setSearch(e.target.value)}
              placeholder="Search filenames and content…"
              className="w-full rounded-xl border border-[#2A2A2A] bg-[#161616] py-2.5 pl-10 pr-4 text-sm text-[#F0EDE8] placeholder:text-[#4A4A46] focus:border-[#4A4A46] focus:outline-none"
            />
          </div>

          {lib.loading ? (
            <div className="flex min-h-[30vh] items-center justify-center">
              <svg className="h-6 w-6 animate-spin text-[#FF4800]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : lib.error ? (
            <div className="rounded-xl border border-[#FF4800]/30 bg-[#161616] p-12 text-center">
              <p className="font-sans text-sm text-[#FF4800]">
                Couldn&apos;t load your spins: {lib.error}
              </p>
              <button
                onClick={() => lib.reload()}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#2A2A2A] px-5 py-2 text-sm font-semibold text-[#F0EDE8] transition-colors hover:border-[#4A4A46]"
              >
                Try again
              </button>
            </div>
          ) : lib.spins.length === 0 ? (
            <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-12 text-center">
              <FileText className="mx-auto mb-3 h-8 w-8 text-[#4A4A46]" />
              {filtersActive ? (
                <>
                  <p className="font-sans text-sm text-[#888480]">
                    No spins match these filters.
                  </p>
                  <button
                    onClick={clearFilters}
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#2A2A2A] px-5 py-2 text-sm font-semibold text-[#F0EDE8] transition-colors hover:border-[#4A4A46]"
                  >
                    Clear filters
                  </button>
                </>
              ) : (
                <>
                  <p className="font-sans text-sm text-[#888480]">
                    Your Vault is empty.
                  </p>
                  <p className="font-sans text-sm text-[#888480]">
                    Add markdown directly, or convert a file first.
                  </p>
                  <div className="mt-4 flex justify-center gap-3">
                    <Link
                      href="/app/vault/add"
                      className="inline-flex items-center gap-2 rounded-full bg-[#FF4800] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#e04200]"
                    >
                      Add markdown
                    </Link>
                    <Link
                      href="/app"
                      className="inline-flex items-center gap-2 rounded-full border border-[#2A2A2A] px-5 py-2 text-sm font-semibold text-[#F0EDE8] transition-colors hover:border-[#4A4A46]"
                    >
                      Convert a file
                    </Link>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {lib.spins.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => lib.openSpin(c.id)}
                    className="w-full rounded-xl border border-[#2A2A2A] bg-[#161616] p-4 text-left transition-colors hover:border-[#3A3A3A]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-[#F0EDE8]">
                            {c.title || c.filename}
                          </p>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-[#4A4A46]">
                          <span>{formatDate(c.converted_at)}</span>
                          {c.word_count != null && <span>{c.word_count.toLocaleString()} words</span>}
                          {(() => {
                            const project = lib.projects.find((p) => p.id === primaryProjectId(c))
                            return project ? (
                              <span className="inline-flex items-center gap-1.5 text-[#888480]">
                                <span
                                  className="h-2 w-2 rounded-sm"
                                  style={{ background: project.color ?? "#888480" }}
                                />
                                {project.name}
                              </span>
                            ) : null
                          })()}
                          {c.brief_generated_at && (
                            <span className="inline-flex items-center gap-1 text-[#FF4800]">
                              <Sparkles className="h-3 w-3" /> Brief
                            </span>
                          )}
                        </div>
                        {c.summary && (
                          <p className="mt-2 line-clamp-2 text-xs text-[#888480]">{c.summary}</p>
                        )}
                        {c.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {c.tags.map((t) => (
                              <span
                                key={t}
                                className="rounded-full bg-[#FF4800]/10 px-2 py-0.5 text-[10px] text-[#FF4800]"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCopy(c.id)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.stopPropagation()
                            handleCopy(c.id)
                          }
                        }}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#2A2A2A] text-[#4A4A46] transition-colors hover:border-[#4A4A46] hover:text-[#F0EDE8] disabled:opacity-40"
                        title="Copy markdown"
                      >
                        {copyingId === c.id && copiedId !== c.id ? (
                          <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : copiedId === c.id ? (
                          <Check className="h-3.5 w-3.5 text-[#FF4800]" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {lib.hasMore && (
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={lib.loadMore}
                    className="rounded-full border border-[#2A2A2A] px-6 py-2 text-sm text-[#888480] transition-colors hover:border-[#4A4A46] hover:text-[#F0EDE8]"
                  >
                    Load more
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <SpinDetailPanel
        spin={lib.selectedSpin}
        projects={lib.projects}
        onClose={lib.closeSpin}
        onSave={lib.saveSpin}
        onDelete={lib.removeSpin}
        onRemoveFromVault={lib.removeSpinFromVault}
        onOpen={lib.openSpin}
        onBriefGenerated={lib.patchSpinBrief}
        onSummaryGenerated={lib.patchSpinSummary}
      />
    </div>
  )
}
