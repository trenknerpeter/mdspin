"use client"

import { useEffect, useRef, useState } from "react"
import { Copy, Download, Trash2, Check, GitBranch, Unlock } from "lucide-react"
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

// Matches the old fixed "edit" width — now the shared default for both
// preview and edit, since a manual drag hasn't happened yet.
const DEFAULT_PANEL_WIDTH = 768
const MIN_PANEL_WIDTH = 380
const PANEL_WIDTH_STORAGE_KEY = "spin-detail-panel-width"

export function SpinDetailPanel({
  spin,
  projects,
  onClose,
  onSave,
  onDelete,
  onRemoveFromVault,
  onDetach,
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
  /** Permanently unlink a synced document so its body/title become editable again.
   *  Absent from callers (e.g. the Knowledge Map's own panel) that haven't wired it
   *  up yet — those just don't offer the button. */
  onDetach?: (id: string) => Promise<void>
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
  const [detaching, setDetaching] = useState(false)
  const [copied, setCopied] = useState(false)
  const [relatedCount, setRelatedCount] = useState(0)
  const [relatedLoading, setRelatedLoading] = useState(true)
  const [brief, setBrief] = useState<string | null>(null)
  const [briefAt, setBriefAt] = useState<string | null>(null)
  const [manualWidth, setManualWidth] = useState<number | null>(null)

  useEffect(() => {
    const stored = window.localStorage.getItem(PANEL_WIDTH_STORAGE_KEY)
    const parsed = stored ? Number(stored) : NaN
    if (Number.isFinite(parsed)) setManualWidth(parsed)
  }, [])

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

  // A linked sync doc is read-only at the database (conversions_source_link_guard
  // rejects the write outright) — this just keeps the UI from offering an edit that
  // would fail, rather than being the thing that actually enforces it.
  const isLinkedSync = spin.source_type === "sync" && spin.source_link_state === "linked"

  // Rewriting an imported document is allowed here (people fix bad OCR), but the
  // source_type check exists elsewhere (MCP write tools, Stage 4) where an agent
  // — not a human who can see what they're doing — is the one making the edit.
  const editHint = isLinkedSync
    ? "Synced from GitHub — detach to edit"
    : spin.source_type === "conversion"
      ? "Editing converted markdown"
      : spin.source_type === "upload"
        ? "Editing an uploaded file"
        : undefined

  const handleSave = async () => {
    setSaving(true)
    try {
      const fields: UpdateSpinFields = {
        title: title.trim() === "" ? null : title.trim(),
        project_id: projectId === UNFILED ? null : projectId,
        tags,
      }
      // Only include markdown_text when it actually changed. Sending it unconditionally
      // (as this used to) burns a summary regeneration on every tag-only edit, and would
      // trip the source-link guard on a linked sync doc even though the UI never let the
      // content field change.
      if (content !== (spin.markdown_text ?? "")) {
        fields.markdown_text = content
      }
      await onSave(spin.id, fields)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const handleDetach = async () => {
    if (!onDetach) return
    setDetaching(true)
    try {
      await onDetach(spin.id)
    } finally {
      setDetaching(false)
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
  const panelWidth = manualWidth ?? DEFAULT_PANEL_WIDTH

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = panelWidth
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"

    const clamp = (px: number) => {
      const max = Math.min(window.innerWidth - 48, 1400)
      return Math.max(MIN_PANEL_WIDTH, Math.min(px, max))
    }

    // Panel is right-anchored, so dragging left (mouse moves to a smaller
    // clientX than startX) should widen it.
    const onMove = (moveEvent: MouseEvent) => {
      setManualWidth(clamp(startWidth + (startX - moveEvent.clientX)))
    }
    const onUp = () => {
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      setManualWidth((w) => {
        const finalWidth = w ?? startWidth
        window.localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(finalWidth))
        return finalWidth
      })
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  return (
    <Sheet open={!!spin} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        style={{ ["--panel-width" as string]: `${panelWidth}px` }}
        className="w-full gap-0 border-[#2A2A2A] bg-[#161616] sm:w-[var(--panel-width)] sm:max-w-[90vw]"
      >
        <div
          onMouseDown={handleResizeStart}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panel"
          className="absolute inset-y-0 left-0 z-10 hidden w-1.5 -translate-x-0.5 touch-none cursor-col-resize select-none hover:bg-[#FF4800]/40 sm:block"
        />
        <SheetHeader className="border-b border-[#2A2A2A]">
          <SheetTitle className="truncate pr-8 text-[#F0EDE8]">
            {spin.title || spin.filename}
          </SheetTitle>
          <p className="text-xs text-[#888480]">
            Source: <span className="uppercase">{spin.file_type}</span>
            {spin.word_count != null && <> · {spin.word_count.toLocaleString()} words</>}
          </p>
          {spin.source_type === "sync" && (
            <div className="flex items-center gap-1.5 pt-1 text-xs text-[#888480]">
              <GitBranch className="h-3 w-3 shrink-0" />
              {spin.source_link_state === "missing" ? (
                <span>No longer found at the source</span>
              ) : spin.external_url ? (
                <a
                  href={spin.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate underline decoration-dotted hover:text-[#F0EDE8]"
                >
                  Synced from GitHub
                </a>
              ) : (
                <span>Synced from GitHub</span>
              )}
            </div>
          )}
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="space-y-1.5">
            <label className={fieldLabel}>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={spin.filename}
              disabled={isLinkedSync}
              className={inputBase + " disabled:opacity-50"}
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
              {/* Grouped one level deep. The value stays a scalar project id — a
                  subproject is just another project — so no write path changes. */}
              {projects
                .filter((p) => !p.parent_id)
                .map((root) => {
                  const children = projects.filter((c) => c.parent_id === root.id)
                  if (children.length === 0) {
                    return (
                      <option key={root.id} value={root.id}>
                        {root.name}
                      </option>
                    )
                  }
                  return (
                    <optgroup key={root.id} label={root.name}>
                      <option value={root.id}>{root.name}</option>
                      {children.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  )
                })}
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
            disabled={saving || isLinkedSync}
          />

          {isLinkedSync && onDetach && (
            <button
              onClick={handleDetach}
              disabled={detaching}
              className="flex items-center justify-center gap-1.5 self-start rounded-full border border-[#2A2A2A] px-3 py-1.5 text-xs font-medium text-[#888480] transition-colors hover:border-[#4A4A46] hover:text-[#F0EDE8] disabled:cursor-not-allowed disabled:opacity-40"
              title="Permanently unlink this document from its source connection so you can edit it"
            >
              <Unlock className="h-3.5 w-3.5" />
              {detaching ? "Detaching…" : "Detach to edit"}
            </button>
          )}

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
