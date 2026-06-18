"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Check, Sparkles } from "lucide-react"
import type { User } from "@supabase/supabase-js"
import { RelatedSpins } from "@/components/library/related-spins"
import { TagInput } from "@/components/library/tag-input"
import {
  addToVault,
  insertVaultConversions,
  createProject,
  listProjects,
  UNFILED,
  type Project,
  type ConversionFileInput,
} from "@/lib/library"
import type { FileItem } from "./types"

export function AddToVaultPanel({
  files,
  user,
  onAuthRequired,
  stashForSignIn,
  resumeOpen,
  onResumeHandled,
  autoSaveSettled = true,
}: {
  files: FileItem[] // successful files only
  user: User | null
  onAuthRequired?: () => void
  stashForSignIn: (tags: string[]) => boolean
  resumeOpen: boolean
  onResumeHandled: () => void
  autoSaveSettled?: boolean // false while signed-in auto-save inserts are still in flight
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set(files.map((f) => f.id)))
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState<string>(UNFILED)
  const [tags, setTags] = useState<string[]>([])
  const [creatingProject, setCreatingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [saving, setSaving] = useState(false)
  const [addedCount, setAddedCount] = useState<number | null>(null)
  const [addedIds, setAddedIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  // Keep checkboxes in sync when the set of files changes (e.g. resume rehydrate).
  useEffect(() => {
    setChecked(new Set(files.map((f) => f.id)))
    setAddedCount(null)
    setAddedIds([])
  }, [files])

  useEffect(() => {
    if (user) listProjects().then(setProjects).catch(() => {})
  }, [user])

  useEffect(() => {
    if (resumeOpen) onResumeHandled()
  }, [resumeOpen, onResumeHandled])

  const toInput = (f: FileItem): ConversionFileInput => ({
    filename: f.name,
    file_type: f.fileType ?? "md",
    word_count: f.wordCount ?? null,
    markdown_text: f.markdown ?? "",
  })

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const selectedCount = useMemo(() => files.filter((f) => checked.has(f.id)).length, [files, checked])

  const handleAdd = async () => {
    if (!user) {
      stashForSignIn(tags)
      onAuthRequired?.()
      return
    }
    setSaving(true)
    setError(null)
    try {
      let pid = projectId
      if (creatingProject && newProjectName.trim()) {
        const created = await createProject(newProjectName.trim())
        pid = created.id
      }
      const opts = { projectId: pid === UNFILED ? null : pid, tags }
      const selected = files.filter((f) => checked.has(f.id))
      const withId = selected.filter((f) => f.conversionId)
      const withoutId = selected.filter((f) => !f.conversionId)
      if (withId.length) await addToVault(withId.map((f) => f.conversionId!), opts)
      if (withoutId.length) await insertVaultConversions(withoutId.map(toInput), opts)
      setAddedCount(selected.length)
      // Only auto-saved rows (withId) have ids to relate against. The withoutId
      // (anonymous-resume insert) path is skipped intentionally — that's a brand-new
      // signed-in user whose vault is effectively empty, so there's nothing to relate to.
      setAddedIds(selected.filter((f) => f.conversionId).map((f) => f.conversionId!))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add to your Vault. Try again.")
    } finally {
      setSaving(false)
    }
  }

  if (files.length === 0) return null

  if (addedCount !== null) {
    return (
      <div className="mb-8 space-y-4">
        <div className="flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/5 px-5 py-4">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white">
            <Check className="h-3.5 w-3.5" />
          </span>
          <span className="flex-1 text-sm text-[#F0EDE8]">Added {addedCount} to your Vault.</span>
          <Link href="/app/vault" className="text-sm font-medium text-[#FF4800] hover:underline">
            View in Vault →
          </Link>
        </div>
        <RelatedSpins
          sourceIds={addedIds}
          className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-4"
        />
      </div>
    )
  }

  const inputBase =
    "w-full rounded-lg border border-[#2A2A2A] bg-[#0E0E0E] px-3 py-2 text-sm text-[#F0EDE8] focus:border-[#4A4A46] focus:outline-none"
  const label = "mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-[#888480]"

  if (!user) {
    return (
      <div className="mb-8 rounded-xl border border-[#FF4800]/30 bg-[#161616] p-5 text-center">
        <p className="text-sm text-[#F0EDE8]">Keep this in your Knowledge Vault</p>
        <p className="mt-1 text-xs text-[#888480]">Sign in to save and organize your converted files.</p>
        <button
          onClick={handleAdd}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#FF4800] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#e04200]"
        >
          <Sparkles className="h-4 w-4" /> Sign in to add to your Vault
        </button>
      </div>
    )
  }

  return (
    <div className="mb-8 overflow-hidden rounded-xl border border-[#FF4800]/40">
      <div className="flex items-center gap-2 border-b border-[#FF4800]/20 bg-[#FF4800]/[0.06] px-5 py-3">
        <Sparkles className="h-4 w-4 text-[#FF4800]" />
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#FF4800]">Add to your Vault</span>
        <span className="ml-auto text-[10px] text-[#4A4A46]">
          {files.length} file{files.length !== 1 ? "s" : ""} converted
        </span>
      </div>
      <div className="flex flex-col gap-4 bg-[#161616] p-5">
        <div className="space-y-1.5">
          {files.map((f) => (
            <label key={f.id} className="flex cursor-pointer items-center gap-2.5 py-1">
              <input
                type="checkbox"
                checked={checked.has(f.id)}
                onChange={() => toggle(f.id)}
                className="h-4 w-4 accent-[#FF4800]"
              />
              <span className="flex-1 truncate text-sm text-[#F0EDE8]">{f.name}</span>
              <span className="text-xs text-[#4A4A46]">from {(f.fileType ?? "md").toUpperCase()}</span>
            </label>
          ))}
        </div>

        <div>
          <label className={label}>Project (optional)</label>
          {creatingProject ? (
            <input
              autoFocus
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onBlur={() => {
                if (!newProjectName.trim()) setCreatingProject(false)
              }}
              placeholder="New project name…"
              className={inputBase}
            />
          ) : (
            <select
              value={projectId}
              onChange={(e) => {
                if (e.target.value === "__new__") {
                  setCreatingProject(true)
                  return
                }
                setProjectId(e.target.value)
              }}
              className={inputBase + " appearance-none"}
            >
              <option value={UNFILED}>Unfiled</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              <option value="__new__">+ New project…</option>
            </select>
          )}
        </div>

        <div>
          <label className={label}>Tags (optional)</label>
          <TagInput value={tags} onChange={setTags} />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          onClick={handleAdd}
          disabled={saving || selectedCount === 0 || !autoSaveSettled}
          className="rounded-full bg-[#FF4800] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#e04200] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {!autoSaveSettled ? "Finishing save…" : saving ? "Adding…" : `Add ${selectedCount} to Vault`}
        </button>
      </div>
    </div>
  )
}
