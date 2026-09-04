"use client"

import { useEffect, useRef, useState } from "react"
import { Copy, Download, Trash2, Check } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { TagInput } from "@/components/library/tag-input"
import { MarkdownEditor, type EditorMode } from "@/components/library/markdown-editor"
import { SummarySection } from "@/components/library/summary-section"
import { primaryProjectId, UNFILED, type Project, type Spin, type UpdateSpinFields } from "@/lib/library"
import { RelatedSpins } from "@/components/library/related-spins"
import { ClusterBriefSection } from "@/components/library/cluster-brief-section"
import type { SummaryStatus } from "@/lib/vault/summary"

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
  onSummaryGenerated,
}: {
  spin: Spin | null
  projects: Project[]
  onClose: () => void
  onSave: (id: string, fields: UpdateSpinFields) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onRemoveFromVault?: (id: string) => Promise<void>
  onOpen?: (id: string) => void
  onBriefGenerated?: (id: string, brief: string, generatedAt: string) => void
  onSummaryGenerated?: (
    id: string,
    fields: { summary: string; summary_status: SummaryStatus; summary_generated_at: string }
  ) => void
}) {
  const [title, setTitle] = useState("")
  const [projectId, setProjectId] = useState<string>(UNFILED)
  const [tags, setTags] = useState<string[]>([])
  const [content, setContent] = useState("")
  const [editorMode, setEditorMode] = useState<EditorMode>("preview")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [relatedCount, setRelatedCount] = useState(0)
  const [relatedLoading, setRelatedLoading] = useState(true)
  const [brief, setBrief] = useState<string | null>(null)
  const [briefAt, setBriefAt] = useState<string | null>(null)

  // Has this doc id had its real content synced into form state yet? Guards
  // against re-syncing on every *update* to the same doc (see below).
  const syncedIdRef = useRef<string | null>(null)
  const syncedContentRef = useRef(false)

  // Sync local form state — but ONLY on (a) opening a genuinely different doc,
  // or (b) the one-time "list row → full record" content arrival for the doc
  // already open (`spin` starts as the list row with markdown_text: null, then
  // re-fires once use-library's openSpin finishes fetching).
  //
  // This is NOT the same as keying the effect on `spin.id` — `spin`'s object
  // reference also changes on every unrelated background update to the SAME
  // doc (generating a summary, generating a brief), because those go through
  // use-library's patchSpinSummary/patchSpinBrief, which replace
  // selectedSpinExtra with a new object. Without this guard, generating a
  // Summary would silently overwrite an in-progress unsaved content edit with
  // the last-saved value, and would reset relatedCount to 0 — hiding Brief
  // again even though relatedness had already been resolved.
  useEffect(() => {
    if (!spin) {
      // Closing doesn't unmount this component (it's gated on spin === null,
      // not unmounted), so without this the refs below would persist across a
      // close → reopen of the SAME doc — meaning reopening wouldn't re-sync
      // fresh content and could resurrect an unsaved, abandoned edit.
      syncedIdRef.current = null
      syncedContentRef.current = false
      return
    }
    const isNewDoc = syncedIdRef.current !== spin.id
    const contentJustArrived = !syncedContentRef.current && spin.markdown_text !== null

    if (isNewDoc) {
      syncedIdRef.current = spin.id
      syncedContentRef.current = false
      setSaved(false)
      setBrief(spin.brief ?? null)
      setBriefAt(spin.brief_generated_at ?? null)
      setRelatedCount(0)
      setRelatedLoading(true)
    }

    if (isNewDoc || contentJustArrived) {
      setTitle(spin.title ?? "")
      setProjectId(primaryProjectId(spin) ?? UNFILED)
      setTags(spin.tags ?? [])
      setContent(spin.markdown_text ?? "")
      // markdown_text is `null` (not yet fetched — list row mid-fetch) vs `""`
      // (fetched, genuinely empty — a brand-new note). Only the latter should
      // open in Edit; the former should stay on Preview so a populated doc
      // doesn't flash into Edit mode while its content is still loading.
      setEditorMode(spin.markdown_text === "" ? "edit" : "preview")
      if (spin.markdown_text !== null) syncedContentRef.current = true
    }
  }, [spin])

  if (!spin) return null

  const dirty =
    title !== (spin.title ?? "") ||
    projectId !== (primaryProjectId(spin) ?? UNFILED) ||
    !sameTags(tags, spin.tags ?? []) ||
    content !== (spin.markdown_text ?? "")

  // Rewriting an imported document is allowed here (people fix bad OCR), but the
  // source_type check exists elsewhere (MCP write tools, Stage 4) where an agent
  // — not a human who can see what they're doing — is the one making the edit.
  const editHint =
    spin.source_type === "conversion"
      ? "Editing converted markdown"
      : spin.source_type === "upload"
        ? "Editing an uploaded file"
        : undefined

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(spin.id, {
        title: title.trim() === "" ? null : title.trim(),
        project_id: projectId === UNFILED ? null : projectId,
        tags,
        markdown_text: content,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const handleCopy = async () => {
    if (!content) return
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    if (!content) return
    const blob = new Blob([content], { type: "text/markdown" })
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
  const sheetWidth =
    editorMode === "edit" ? "sm:max-w-3xl" : brief ? "sm:max-w-2xl" : "sm:max-w-md"

  return (
    <Sheet open={!!spin} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className={`w-full gap-0 border-[#2A2A2A] bg-[#161616] ${sheetWidth}`}>
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

          <SummarySection
            spinId={spin.id}
            summary={spin.summary}
            status={spin.summary_status}
            onGenerated={(fields) => onSummaryGenerated?.(spin.id, fields)}
          />

          <ClusterBriefSection
            sourceId={spin.id}
            brief={brief}
            briefGeneratedAt={briefAt}
            relatedCount={relatedCount}
            relatedLoading={relatedLoading}
            onGenerated={(b, at) => {
              setBrief(b)
              setBriefAt(at)
              onBriefGenerated?.(spin.id, b, at)
            }}
          />

          <MarkdownEditor
            value={content}
            onChange={setContent}
            mode={editorMode}
            onModeChange={setEditorMode}
            onSaveShortcut={handleSave}
            hint={editHint}
            disabled={saving}
          />

          <RelatedSpins
            sourceIds={[spin.id]}
            onOpen={onOpen}
            onCount={setRelatedCount}
            onLoadingChange={setRelatedLoading}
          />
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
            disabled={!content}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-[#2A2A2A] text-[#888480] transition-colors hover:border-[#4A4A46] hover:text-[#F0EDE8] disabled:opacity-40"
            title="Copy markdown"
          >
            {copied ? <Check className="h-4 w-4 text-[#FF4800]" /> : <Copy className="h-4 w-4" />}
          </button>
          <button
            onClick={handleDownload}
            disabled={!content}
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
