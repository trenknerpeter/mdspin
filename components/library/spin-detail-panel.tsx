"use client"

import { useEffect, useState } from "react"
import { remark } from "remark"
import remarkGfm from "remark-gfm"
import remarkHtml from "remark-html"
import { Copy, Download, Trash2, Check } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { TagInput } from "@/components/library/tag-input"
import { UNFILED, type Project, type Spin } from "@/lib/library"
import { RelatedSpins } from "@/components/library/related-spins"
import { ClusterBriefSection } from "@/components/library/cluster-brief-section"

const PREVIEW_CAP = 8000

function sameTags(a: string[], b: string[]) {
  return a.length === b.length && a.every((t, i) => t === b[i])
}

export function SpinDetailPanel({
  spin,
  projects,
  onClose,
  onSave,
  onDelete,
  onRemoveFromVault,
  onOpen,
  onBriefGenerated,
}: {
  spin: Spin | null
  projects: Project[]
  onClose: () => void
  onSave: (
    id: string,
    fields: { title?: string | null; project_id?: string | null; tags?: string[] }
  ) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onRemoveFromVault?: (id: string) => Promise<void>
  onOpen?: (id: string) => void
  onBriefGenerated?: (id: string, brief: string, generatedAt: string) => void
}) {
  const [title, setTitle] = useState("")
  const [projectId, setProjectId] = useState<string>(UNFILED)
  const [tags, setTags] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [previewHtml, setPreviewHtml] = useState("")
  const [relatedCount, setRelatedCount] = useState(0)
  const [brief, setBrief] = useState<string | null>(null)
  const [briefAt, setBriefAt] = useState<string | null>(null)

  // Sync local form state when the selected spin changes
  useEffect(() => {
    if (!spin) return
    setTitle(spin.title ?? "")
    setProjectId(spin.project_id ?? UNFILED)
    setTags(spin.tags ?? [])
    setSaved(false)
    setBrief(spin.brief ?? null)
    setBriefAt(spin.brief_generated_at ?? null)
    setRelatedCount(0)
  }, [spin])

  // Render a (capped) markdown preview
  useEffect(() => {
    let cancelled = false
    const md = spin?.markdown_text
    if (!md) {
      setPreviewHtml("")
      return
    }
    const capped = md.length > PREVIEW_CAP ? md.slice(0, PREVIEW_CAP) : md
    remark()
      .use(remarkGfm)
      .use(remarkHtml)
      .process(capped)
      .then((r) => {
        if (!cancelled) setPreviewHtml(String(r))
      })
      .catch(() => {
        if (!cancelled) setPreviewHtml("")
      })
    return () => {
      cancelled = true
    }
  }, [spin])

  if (!spin) return null

  const dirty =
    title !== (spin.title ?? "") ||
    projectId !== (spin.project_id ?? UNFILED) ||
    !sameTags(tags, spin.tags ?? [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(spin.id, {
        title: title.trim() === "" ? null : title.trim(),
        project_id: projectId === UNFILED ? null : projectId,
        tags,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const handleCopy = async () => {
    if (!spin.markdown_text) return
    await navigator.clipboard.writeText(spin.markdown_text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    if (!spin.markdown_text) return
    const blob = new Blob([spin.markdown_text], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = (spin.title || spin.filename).replace(/\.[^/.]+$/, "") + ".md"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const fieldLabel = "text-[10px] font-semibold uppercase tracking-wide text-[#888480]"
  const inputBase =
    "w-full rounded-lg border border-[#2A2A2A] bg-[#0E0E0E] px-3 py-2 text-sm text-[#F0EDE8] focus:border-[#4A4A46] focus:outline-none"

  return (
    <Sheet open={!!spin} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className={`w-full gap-0 border-[#2A2A2A] bg-[#161616] ${brief ? "sm:max-w-2xl" : "sm:max-w-md"}`}
      >
        <SheetHeader className="border-b border-[#2A2A2A]">
          <SheetTitle className="truncate pr-8 text-[#F0EDE8]">
            {spin.title || spin.filename}
          </SheetTitle>
          <p className="text-xs text-[#888480]">
            Source: <span className="uppercase">{spin.file_type}</span>
            {spin.word_count != null && <> · {spin.word_count.toLocaleString()} words</>}
          </p>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="space-y-1.5">
            <label className={fieldLabel}>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={spin.filename}
              className={inputBase}
            />
          </div>

          <div className="space-y-1.5">
            <label className={fieldLabel}>Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className={inputBase + " appearance-none"}
            >
              <option value={UNFILED}>Unfiled</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className={fieldLabel}>Tags</label>
            <TagInput value={tags} onChange={setTags} />
          </div>

          <ClusterBriefSection
            sourceId={spin.id}
            brief={brief}
            briefGeneratedAt={briefAt}
            relatedCount={relatedCount}
            onGenerated={(b, at) => {
              setBrief(b)
              setBriefAt(at)
              onBriefGenerated?.(spin.id, b, at)
            }}
          />
          <div className="flex-1 space-y-1.5">
            <label className={fieldLabel}>Preview</label>
            <div className="rounded-lg border border-[#2A2A2A] bg-[#0E0E0E] p-3">
              {previewHtml ? (
                <div
                  className="prose prose-invert prose-sm max-w-none text-[#C9C5BE] [&_a]:text-[#FF4800] [&_code]:text-[#F0EDE8] [&_h1]:text-[#F0EDE8] [&_h2]:text-[#F0EDE8] [&_h3]:text-[#F0EDE8] [&_strong]:text-[#F0EDE8]"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              ) : (
                <p className="text-sm text-[#4A4A46]">No preview available.</p>
              )}
              {spin.markdown_text && spin.markdown_text.length > PREVIEW_CAP && (
                <p className="mt-3 border-t border-[#2A2A2A] pt-2 text-xs text-[#4A4A46]">
                  Preview truncated — download or copy for the full document.
                </p>
              )}
            </div>
          </div>
          <RelatedSpins sourceIds={[spin.id]} onOpen={onOpen} onCount={setRelatedCount} />
        </div>

        <div className="flex items-center gap-2 border-t border-[#2A2A2A] p-4">
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="flex-1 rounded-full bg-[#FF4800] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#e04200] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saved ? "Saved" : saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={handleCopy}
            disabled={!spin.markdown_text}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-[#2A2A2A] text-[#888480] transition-colors hover:border-[#4A4A46] hover:text-[#F0EDE8] disabled:opacity-40"
            title="Copy markdown"
          >
            {copied ? <Check className="h-4 w-4 text-[#FF4800]" /> : <Copy className="h-4 w-4" />}
          </button>
          <button
            onClick={handleDownload}
            disabled={!spin.markdown_text}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-[#2A2A2A] text-[#888480] transition-colors hover:border-[#4A4A46] hover:text-[#F0EDE8] disabled:opacity-40"
            title="Download .md"
          >
            <Download className="h-4 w-4" />
          </button>
          {onRemoveFromVault && (
            <button
              onClick={async () => {
                await onRemoveFromVault(spin.id)
                onClose()
              }}
              className="rounded-full border border-[#2A2A2A] px-3 py-2 text-xs font-medium text-[#888480] transition-colors hover:border-[#4A4A46] hover:text-[#F0EDE8]"
              title="Remove from Vault (keeps it in History)"
            >
              Remove from Vault
            </button>
          )}
          <button
            onClick={async () => {
              await onDelete(spin.id)
              onClose()
            }}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-[#2A2A2A] text-[#888480] transition-colors hover:border-red-500/30 hover:text-red-400"
            title="Delete spin"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
