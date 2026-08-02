"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Upload, FolderUp, FileText, Check, AlertCircle } from "lucide-react"
import { TagInput } from "@/components/library/tag-input"
import { useVaultIngest } from "@/components/vault/use-vault-ingest"
import type { FolderMappingMode } from "@/lib/vault/paths"
import { INGEST_EXTS, MAX_IMPORT_FILES } from "@/lib/vault/limits"

type Tab = "files" | "folder" | "paste"

const MODE_LABELS: Record<FolderMappingMode, string> = {
  "top-folder-project": "Top folder → project, subfolders → tags",
  "all-tags": "All folders → tags (no projects created)",
  ignore: "Ignore folder structure",
}

export function VaultIngestPanel({ initialTab = "files" }: { initialTab?: Tab }) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>(initialTab)
  const [pasteText, setPasteText] = useState("")
  const [pasteTitle, setPasteTitle] = useState("")
  const filesInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const ingest = useVaultIngest()

  // The parent page resolves initialTab from window.location.search inside its
  // OWN mount effect, which fires after this component has already mounted
  // with the stale default. useState(initialTab) only reads the prop once, so
  // without this the panel always opened on "files" regardless of which menu
  // item was clicked. Syncing on every change (not just mount) picks up that
  // one-time update; it's a no-op afterward since initialTab never changes again.
  useEffect(() => {
    setTab(initialTab)
  }, [initialTab])

  // webkitdirectory isn't in React's JSX typings and can't be reliably toggled
  // on a shared input — set it imperatively on a dedicated folder input.
  useEffect(() => {
    const el = folderInputRef.current
    if (!el) return
    el.setAttribute("webkitdirectory", "")
    el.setAttribute("directory", "")
  }, [])

  const acceptAttr = INGEST_EXTS.map((e) => `.${e}`).join(",")

  const handleFilesChosen = (fileList: FileList | null, via: "files" | "folder") => {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList).slice(0, MAX_IMPORT_FILES)
    ingest.scan(files, via)
  }

  const label = "mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-[#888480]"
  const inputBase =
    "w-full rounded-lg border border-[#2A2A2A] bg-[#0E0E0E] px-3 py-2 text-sm text-[#F0EDE8] focus:border-[#4A4A46] focus:outline-none"

  // ---- Phase: idle — pick a source ----
  if (ingest.phase === "idle") {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 inline-flex gap-1 rounded-lg border border-[#2A2A2A] bg-[#161616] p-1">
          {(["files", "folder", "paste"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === t ? "bg-[#FF4800] text-white" : "text-[#888480] hover:text-[#F0EDE8]"
              }`}
            >
              {t === "files" ? "Upload files" : t === "folder" ? "Import a folder" : "Paste markdown"}
            </button>
          ))}
        </div>

        {ingest.scanError && (
          <p className="mb-4 flex items-center gap-1.5 text-sm text-red-400">
            <AlertCircle className="h-4 w-4" /> {ingest.scanError}
          </p>
        )}

        {tab === "files" && (
          <div
            onClick={() => filesInputRef.current?.click()}
            className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#2A2A2A] bg-[#161616] p-6 text-center transition-colors hover:border-[#3A3A3A]"
          >
            <input
              ref={filesInputRef}
              type="file"
              multiple
              accept={acceptAttr}
              className="hidden"
              onChange={(e) => handleFilesChosen(e.target.files, "files")}
            />
            <Upload className="mb-3 h-6 w-6 text-[#4A4A46]" strokeWidth={1.5} />
            <p className="text-sm font-medium text-[#888480]">Choose markdown files</p>
            <p className="mt-1 text-xs text-[#4A4A46]">.md, .markdown, .mdx, .txt — up to {MAX_IMPORT_FILES} files</p>
          </div>
        )}

        {tab === "folder" && (
          <div
            onClick={() => folderInputRef.current?.click()}
            className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#2A2A2A] bg-[#161616] p-6 text-center transition-colors hover:border-[#3A3A3A]"
          >
            <input
              ref={folderInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFilesChosen(e.target.files, "folder")}
            />
            <FolderUp className="mb-3 h-6 w-6 text-[#4A4A46]" strokeWidth={1.5} />
            <p className="text-sm font-medium text-[#888480]">Choose a folder</p>
            <p className="mt-1 text-xs text-[#4A4A46]">
              Every markdown file inside is scanned; non-markdown files are skipped
            </p>
          </div>
        )}

        {tab === "paste" && (
          <div className="space-y-3 rounded-xl border border-[#2A2A2A] bg-[#161616] p-5">
            <div>
              <label className={label}>Title (optional)</label>
              <input
                value={pasteTitle}
                onChange={(e) => setPasteTitle(e.target.value)}
                placeholder="Untitled note"
                className={inputBase}
              />
            </div>
            <div>
              <label className={label}>Markdown</label>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={10}
                placeholder="Paste markdown here…"
                className={inputBase + " resize-y font-mono text-xs"}
              />
            </div>
            <button
              onClick={() => {
                if (!pasteText.trim()) return
                const filename = pasteTitle.trim()
                  ? `${pasteTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`
                  : "pasted-note.md"
                const text = pasteTitle.trim() ? `# ${pasteTitle.trim()}\n\n${pasteText}` : pasteText
                ingest.scanPasted(text, filename)
              }}
              disabled={!pasteText.trim()}
              className="rounded-full bg-[#FF4800] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#e04200] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    )
  }

  // ---- Phase: scanning ----
  if (ingest.phase === "scanning") {
    const pct = ingest.scanProgress.total
      ? Math.round((ingest.scanProgress.done / ingest.scanProgress.total) * 100)
      : 0
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-[#2A2A2A] bg-[#161616] p-8 text-center">
        <FileText className="mx-auto mb-3 h-6 w-6 animate-pulse text-[#FF4800]" />
        <p className="text-sm text-[#888480]">
          Reading {ingest.scanProgress.done} of {ingest.scanProgress.total}
        </p>
        <div className="mx-auto mt-3 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-[#2A2A2A]">
          <div className="h-full bg-[#FF4800] transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
    )
  }

  // ---- Phase: review ----
  if (ingest.phase === "review") {
    const { outcome } = ingest
    const skipParts: string[] = []
    if (outcome.skipped.already_in_vault) skipParts.push(`${outcome.skipped.already_in_vault} already in Vault`)
    if (outcome.skipped.duplicate_in_batch) skipParts.push(`${outcome.skipped.duplicate_in_batch} duplicates in this batch`)
    if (outcome.skipped.too_large) skipParts.push(`${outcome.skipped.too_large} too large`)
    if (outcome.skipped.empty) skipParts.push(`${outcome.skipped.empty} empty`)

    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-4">
          <p className="text-sm text-[#F0EDE8]">
            <span className="font-semibold text-[#FF4800]">{outcome.ready}</span> ready to import
            {skipParts.length > 0 && <span className="text-[#888480]"> · {skipParts.join(" · ")}</span>}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-xl border border-[#2A2A2A] bg-[#161616] p-4 sm:grid-cols-2">
          <div>
            <label className={label}>Folder mapping</label>
            <select
              value={ingest.mode}
              onChange={(e) => ingest.setMode(e.target.value as FolderMappingMode)}
              className={inputBase + " appearance-none"}
            >
              {(Object.keys(MODE_LABELS) as FolderMappingMode[]).map((m) => (
                <option key={m} value={m}>
                  {MODE_LABELS[m]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Default project (optional)</label>
            <select
              value={ingest.defaultProjectName ?? ""}
              onChange={(e) => ingest.setDefaultProjectName(e.target.value || null)}
              className={inputBase + " appearance-none"}
            >
              <option value="">None</option>
              {ingest.projectNameOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Default tags (optional)</label>
            <TagInput value={ingest.defaultTags} onChange={ingest.setDefaultTags} />
          </div>
        </div>

        {ingest.readyDocs.length > 0 && (
          <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-[#2A2A2A] bg-[#161616] p-3">
            {ingest.readyDocs.map((d, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm">
                <FileText className="h-3.5 w-3.5 shrink-0 text-[#4A4A46]" />
                <span className="min-w-0 flex-1 truncate text-[#F0EDE8]">{d.row.title}</span>
                {d.projectNames[0] && (
                  <span className="shrink-0 rounded-full bg-[#2A2A2A] px-2 py-0.5 text-[10px] text-[#888480]">
                    {d.projectNames[0]}
                  </span>
                )}
                {d.row.tags.slice(0, 3).map((t) => (
                  <span key={t} className="shrink-0 rounded-full bg-[#FF4800]/10 px-2 py-0.5 text-[10px] text-[#FF4800]">
                    #{t}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={ingest.reset}
            className="rounded-full border border-[#2A2A2A] px-5 py-2 text-sm text-[#888480] transition-colors hover:border-[#4A4A46] hover:text-[#F0EDE8]"
          >
            Cancel
          </button>
          <button
            onClick={ingest.commit}
            disabled={ingest.totalToCommit === 0}
            className="rounded-full bg-[#FF4800] px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#e04200] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Import {ingest.totalToCommit} document{ingest.totalToCommit !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    )
  }

  // ---- Phase: importing ----
  if (ingest.phase === "importing") {
    const pct = ingest.totalToCommit ? Math.round((ingest.committed / ingest.totalToCommit) * 100) : 0
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-[#2A2A2A] bg-[#161616] p-8 text-center">
        <p className="text-sm text-[#888480]">
          Importing {ingest.committed} of {ingest.totalToCommit}
        </p>
        <div className="mx-auto mt-3 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-[#2A2A2A]">
          <div className="h-full bg-[#FF4800] transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
    )
  }

  // ---- Phase: done ----
  const failedCount = ingest.failedDocs.length
  // Distinguish full success / partial / total failure — a green checkmark on
  // "Imported 0. 1 failed." reads as success when nothing actually landed.
  const allFailed = failedCount > 0 && ingest.committed === 0
  const bannerStyle = allFailed
    ? "border-red-500/30 bg-red-500/5"
    : failedCount > 0
      ? "border-yellow-500/30 bg-yellow-500/5"
      : "border-green-500/30 bg-green-500/5"
  const iconStyle = allFailed ? "bg-red-500" : failedCount > 0 ? "bg-yellow-500" : "bg-green-500"

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className={`flex items-center gap-3 rounded-xl border px-5 py-4 ${bannerStyle}`}>
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${iconStyle}`}>
          {allFailed ? <AlertCircle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
        </span>
        <span className="text-sm text-[#F0EDE8]">
          {allFailed
            ? `Import failed — ${failedCount} document${failedCount !== 1 ? "s" : ""} couldn't be saved.`
            : `Imported ${ingest.committed} document${ingest.committed !== 1 ? "s" : ""}.`}
          {!allFailed && failedCount > 0 && ` ${failedCount} failed.`}
        </span>
      </div>
      <div className="flex gap-2">
        {failedCount > 0 && (
          <button
            onClick={ingest.retryFailed}
            className="rounded-full border border-[#2A2A2A] px-5 py-2 text-sm text-[#888480] transition-colors hover:border-[#4A4A46] hover:text-[#F0EDE8]"
          >
            Retry {failedCount} failed
          </button>
        )}
        <button
          onClick={() => router.push("/app/vault")}
          className="rounded-full bg-[#FF4800] px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#e04200]"
        >
          Go to Vault
        </button>
      </div>
    </div>
  )
}
