"use client"

import { useEffect, useState } from "react"
import { remark } from "remark"
import remarkGfm from "remark-gfm"
import remarkHtml from "remark-html"
import { ChevronDown } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

// Rendering cap for the read-only Preview tab only. The trap this exists to avoid:
// binding a capped string to the textarea would silently discard everything past
// the cap on save. `value` here is always the full document — only the rendered
// HTML in Preview mode is capped, purely for rendering performance on huge docs.
const PREVIEW_CAP = 8000

export type EditorMode = "edit" | "preview"

export function MarkdownEditor({
  value,
  onChange,
  mode,
  onModeChange,
  onSaveShortcut,
  hint,
  disabled,
}: {
  value: string
  onChange: (next: string) => void
  mode: EditorMode
  onModeChange: (mode: EditorMode) => void
  /** Cmd/Ctrl+S while the textarea is focused. */
  onSaveShortcut?: () => void
  /** e.g. "Editing converted markdown" — shown for source_type !== 'note'/'mcp'. */
  hint?: string
  disabled?: boolean
}) {
  const [html, setHtml] = useState("")
  const [open, setOpen] = useState(true)

  useEffect(() => {
    if (mode !== "preview") return
    let cancelled = false
    const capped = value.length > PREVIEW_CAP ? value.slice(0, PREVIEW_CAP) : value
    if (!capped) {
      setHtml("")
      return
    }
    remark()
      .use(remarkGfm)
      .use(remarkHtml)
      .process(capped)
      .then((r) => {
        if (!cancelled) setHtml(String(r))
      })
      .catch(() => {
        if (!cancelled) setHtml("")
      })
    return () => {
      cancelled = true
    }
  }, [mode, value])

  const fieldLabel = "text-[10px] font-semibold uppercase tracking-wide text-[#888480]"

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="flex flex-1 flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <CollapsibleTrigger className="hover:text-[#F0EDE8]" asChild>
          <button type="button" className={`flex items-center gap-1.5 ${fieldLabel}`}>
            <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} />
            Content
          </button>
        </CollapsibleTrigger>
        <div className="inline-flex rounded-md border border-[#2A2A2A] bg-[#0E0E0E] p-0.5">
          {(["edit", "preview"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              className={`rounded px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
                mode === m ? "bg-[#2A2A2A] text-[#F0EDE8]" : "text-[#888480] hover:text-[#F0EDE8]"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <CollapsibleContent className="flex flex-1 flex-col gap-1.5">
        {hint && mode === "edit" && (
          <p className="text-[11px] text-[#888480]">
            {hint} — edits are saved directly to this document.
          </p>
        )}

        {mode === "edit" ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                e.preventDefault()
                onSaveShortcut?.()
              }
            }}
            disabled={disabled}
            spellCheck={false}
            placeholder="Write markdown…"
            className="min-h-[280px] flex-1 resize-y rounded-lg border border-[#2A2A2A] bg-[#0E0E0E] p-3 font-[family-name:var(--font-jetbrains-mono)] text-[13px] leading-relaxed text-[#F0EDE8] focus:border-[#4A4A46] focus:outline-none disabled:opacity-50"
          />
        ) : (
          <div className="min-h-[280px] flex-1 rounded-lg border border-[#2A2A2A] bg-[#0E0E0E] p-3">
            {html ? (
              <div
                className="prose prose-invert prose-sm max-w-none text-[#C9C5BE] [&_a]:text-[#FF4800] [&_code]:text-[#F0EDE8] [&_h1]:text-[#F0EDE8] [&_h2]:text-[#F0EDE8] [&_h3]:text-[#F0EDE8] [&_strong]:text-[#F0EDE8]"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : (
              <p className="text-sm text-[#4A4A46]">No content yet.</p>
            )}
            {value.length > PREVIEW_CAP && (
              <p className="mt-3 border-t border-[#2A2A2A] pt-2 text-xs text-[#4A4A46]">
                Preview truncated at {PREVIEW_CAP.toLocaleString()} characters — switch to Edit to see
                and change the full document.
              </p>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
