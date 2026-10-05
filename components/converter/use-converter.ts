"use client"

import { useState, useRef, useMemo, useCallback, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase/client"
import { track } from "@/lib/analytics/client"
import { EVENTS } from "@/lib/analytics/events"
import { partitionIncomingFiles, groupRejections, type RejectionReason } from "@/lib/converter-intake"
import { savePendingConversion, takePendingConversion, type PendingAction } from "@/lib/pending-conversion"
import type { FileItem, ConverterContext, ConversionOptions } from "./types"
import type { GateReason } from "./sign-in-gate-dialog"

export interface IntakeNotice {
  reason: RejectionReason
  count: number
}

export function useConverter(opts: {
  context: ConverterContext
  options?: ConversionOptions
  onAuthRequired?: (reason?: GateReason) => void
}) {
  const { user } = useAuth()
  const supabase = createClient()

  // --- converter state ---
  const [files, setFiles] = useState<FileItem[]>([])
  const [batchStatus, setBatchStatus] = useState<'idle' | 'converting' | 'done'>('idle')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showMerged, setShowMerged] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [intakeNotices, setIntakeNotices] = useState<IntakeNotice[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // --- input mode state ---
  const [inputMode, setInputMode] = useState<'upload' | 'url'>('upload')
  const [url, setUrl] = useState('')

  // --- rate limit state ---
  const [rateLimited, setRateLimited] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [dailyLimit, setDailyLimit] = useState<number | null>(null)

  const [resumeVaultAdd, setResumeVaultAdd] = useState(false)
  // Resume-after-sign-in state (effects live below handleSpin).
  const [resumeAction, setResumeAction] = useState<PendingAction | null>(null)
  const [resumedFromPreview, setResumedFromPreview] = useState(false)
  const resumeSpin = useRef(false)
  // True once all signed-in auto-save inserts have resolved. The Add-to-Vault panel
  // waits on this so it never falls back to an insert before the row id is captured
  // (which would create a duplicate History row).
  const [autoSaveSettled, setAutoSaveSettled] = useState(true)
  const pendingInserts = useRef(0)

  // Derive appState for UI logic
  const appState = batchStatus === 'idle' && files.length === 0
    ? 'idle'
    : batchStatus === 'converting'
      ? 'converting'
      : batchStatus === 'done'
        ? 'done'
        : 'loaded'

  // --- converter handlers ---
  // The decision of which incoming files are accepted lives in the pure
  // partitionIncomingFiles() — every rejection now carries a reason instead of
  // being silently dropped (unsupported/oversize/duplicate were previously
  // discarded with no feedback, and the file/image caps used to truncate via
  // .slice() rather than telling the user anything was cut).
  const handleFiles = useCallback((newFiles: File[]) => {
    setFiles(prev => {
      const existing = prev.map(fi => ({
        name: fi.file ? fi.file.name : fi.name,
        size: fi.file ? fi.file.size : 0,
      }))
      const { accepted, rejected } = partitionIncomingFiles(existing, newFiles)

      setIntakeNotices(
        rejected.length > 0
          ? groupRejections(rejected).map((g) => ({ reason: g.reason, count: g.names.length }))
          : []
      )

      return [...prev, ...accepted.map(f => ({
        id: crypto.randomUUID(),
        name: f.name,
        file: f,
        status: 'queued' as const,
        fileType: f.name.split('.').pop()?.toLowerCase()
      }))]
    })
  }, [])

  const dismissIntakeNotices = useCallback(() => setIntakeNotices([]), [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      handleFiles(Array.from(e.dataTransfer.files))
    },
    [handleFiles]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleBrowse = () => {
    fileInputRef.current?.click()
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(Array.from(e.target.files ?? []))
  }

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(fi => fi.id !== id))
  }, [])

  const handleCopyFile = async (id: string, markdown: string) => {
    await navigator.clipboard.writeText(markdown)
    track(EVENTS.markdownCopied, { source: "converter" })
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDownloadFile = (filename: string, markdown: string) => {
    track(EVENTS.markdownDownloaded, { source: "converter", filename })
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename.replace(/\.[^/.]+$/, '') + '.md'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Anything behind the preview wall: stash the original file, then show sign-in.
  // Guests can only ever hold one file (lib/gating.ts), so files[0] is the file.
  const requestFullResult = useCallback(async (action: PendingAction) => {
    track(EVENTS.previewGateClicked, { action })
    const f = files.find((fi) => fi.file)?.file
    if (f) await savePendingConversion({ file: f, action, createdAt: Date.now() })
    opts.onAuthRequired?.()
  }, [files, opts])

  const isGuestPreview = !user && files.some((fi) => fi.preview?.truncated)

  const handleSpin = async () => {
    if (files.length === 0 || batchStatus === 'converting') return
    if (remaining !== null && files.length > remaining) {
      setError(`You have ${remaining} conversion${remaining !== 1 ? 's' : ''} remaining. Remove ${files.length - remaining} file${files.length - remaining !== 1 ? 's' : ''} to proceed.`)
      return
    }

    // Capture file metadata before any state updates to avoid stale closure in DB inserts
    const fileMetaForInserts = files.map((fi) => ({
      id: fi.id,
      name: fi.name,
      ext: fi.name.split(".").pop()?.toLowerCase() ?? "",
      size: fi.file?.size ?? null, // original byte size — powers exact ROI on the Dashboard
    }))

    track(EVENTS.fileConversionStarted, {
      source: 'upload',
      file_count: files.length,
      file_types: files.map(fi => fi.name.split('.').pop()?.toLowerCase()),
    })
    setBatchStatus('converting')
    setError(null)
    setShowMerged(false)

    // Mark all as converting
    setFiles(prev => prev.map(fi => ({ ...fi, status: 'converting' as const })))

    try {
      const fd = new FormData()
      files.forEach(fi => { if (fi.file) fd.append('files', fi.file) })
      fd.append('options', JSON.stringify(opts.options ?? {}))

      const res = await fetch('/api/convert/batch', { method: 'POST', body: fd })

      // Read rate limit headers first
      const limitHeader = res.headers.get('X-RateLimit-Limit')
      const remainingHeader = res.headers.get('X-RateLimit-Remaining')
      if (limitHeader) setDailyLimit(Number(limitHeader))
      if (remainingHeader) setRemaining(Number(remainingHeader))

      // Check 429 before parsing body
      if (res.status === 429) {
        setRateLimited(true)
        setError(null)
        setBatchStatus('idle')
        setFiles(prev => prev.map(fi => ({ ...fi, status: 'queued' as const })))
        if (!user) {
          const f = files[0]?.file
          if (f) await savePendingConversion({ file: f, action: 'limit', createdAt: Date.now() })
          opts.onAuthRequired?.('limit')
        }
        return
      }

      // Now safe to parse JSON
      let data: { results?: Array<{ success: boolean; markdown_text?: string; error?: string; preview?: { truncated: boolean; total_words: number } }>; message?: string; error?: string }
      try {
        data = await res.json() as typeof data
      } catch {
        setError('Conversion service returned an unexpected response. Try again.')
        setBatchStatus('idle')
        setFiles(prev => prev.map(fi => ({ ...fi, status: 'queued' as const })))
        return
      }

      if (res.status === 401 && data.error === 'AUTH_REQUIRED') {
        setBatchStatus('idle')
        setFiles(prev => prev.map(fi => ({ ...fi, status: 'queued' as const })))
        opts.onAuthRequired?.('feature')
        return
      }

      if (!res.ok) {
        setError(data.message ?? 'Conversion failed. Please try again.')
        setBatchStatus('idle')
        setFiles(prev => prev.map(fi => ({ ...fi, status: 'queued' as const })))
        return
      }

      // Map results back to FileItems
      // Backend returns { success: boolean, markdown_text?: string, error?: string, message?: string, ... } per entry
      const results: Array<{ success: boolean; markdown_text?: string; error?: string; message?: string; preview?: { truncated: boolean; total_words: number } }> = data.results ?? []
      // Results are positional: the backend preserves submission order
      setFiles(prev => prev.map((fi, idx) => {
        const result = results[idx]
        if (!result) return { ...fi, status: 'failed' as const, error: 'No result returned' }
        if (result.success && result.markdown_text) {
          const preview = result.preview?.truncated
            ? { truncated: true, totalWords: result.preview.total_words }
            : undefined
          const wordCount = preview?.totalWords ?? result.markdown_text.split(/\s+/).filter(Boolean).length
          return { ...fi, status: 'done' as const, markdown: result.markdown_text, wordCount, preview }
        }
        return {
          ...fi,
          status: 'failed' as const,
          // Prefer the human-readable message; fall back to the bare error code.
          error: result.message ?? result.error ?? 'Conversion failed',
        }
      }))

      results.forEach((result, idx) => {
        const fi = files[idx]
        const ext = fi?.name.split('.').pop()?.toLowerCase()
        if (result.success && result.markdown_text) {
          const wordCount = result.preview?.total_words ?? result.markdown_text.split(/\s+/).filter(Boolean).length
          track(EVENTS.fileConversionCompleted, { source: 'upload', file_type: ext, word_count: wordCount })
        } else {
          track(EVENTS.fileConversionFailed, { source: 'upload', file_type: ext, error: result.error ?? 'Conversion failed' })
        }
      })
      setBatchStatus('done')
      if (!user && results.some((r) => r.preview?.truncated)) {
        track(EVENTS.previewShown, { word_count: results[0]?.preview?.total_words ?? null })
      }

      // Auto-save to history — signed-in users only. Capture row ids for "Add to Vault".
      if (user) {
        const insertCount = results.filter(
          (r, idx) => r.success && r.markdown_text && fileMetaForInserts[idx]
        ).length
        if (insertCount > 0) {
          // Additive so a second convert run while a prior batch is still
          // inserting can't clobber the in-flight count and flip the gate early.
          pendingInserts.current += insertCount
          setAutoSaveSettled(false)
        }
        results.forEach((result, idx) => {
          if (!(result.success && result.markdown_text)) return
          const meta = fileMetaForInserts[idx]
          if (!meta) return
          const wordCount = result.preview?.total_words ?? result.markdown_text.split(/\s+/).filter(Boolean).length
          Promise.resolve(
            supabase
              .from("conversions")
              .insert({
                user_id: user.id,
                filename: meta.name,
                file_type: meta.ext,
                word_count: wordCount,
                markdown_text: result.markdown_text,
                source_bytes: meta.size,
              })
              .select("id")
              .single()
          )
            .then(({ data, error: insertError }) => {
              if (insertError) {
                console.error("[conversions] insert failed:", insertError.message)
                return
              }
              if (data?.id) {
                setFiles((prev) =>
                  prev.map((fi) => (fi.id === meta.id ? { ...fi, conversionId: data.id } : fi))
                )
              }
            })
            .finally(() => {
              pendingInserts.current -= 1
              if (pendingInserts.current <= 0) setAutoSaveSettled(true)
            })
        })
      }

    } catch {
      setError('Network error. Check your connection and try again.')
      setBatchStatus('idle')
      setFiles(prev => prev.map(fi => ({ ...fi, status: 'queued' as const })))
    }
  }

  const handleConvertUrl = async () => {
    const trimmed = url.trim()
    if (!trimmed || batchStatus === 'converting') return

    let parsed: URL
    try {
      parsed = new URL(trimmed)
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('not http(s)')
    } catch {
      setError('Enter a valid http(s) URL.')
      return
    }

    track(EVENTS.fileConversionStarted, { file_count: 1, source: 'url' })
    setError(null)
    setRateLimited(false)
    setShowMerged(false)
    setBatchStatus('converting')

    try {
      const res = await fetch('/api/convert/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed, options: opts.options ?? {} }),
      })

      const limitHeader = res.headers.get('X-RateLimit-Limit')
      const remainingHeader = res.headers.get('X-RateLimit-Remaining')
      if (limitHeader) setDailyLimit(Number(limitHeader))
      if (remainingHeader) setRemaining(Number(remainingHeader))

      if (res.status === 429) {
        setRateLimited(true)
        setBatchStatus('idle')
        if (!user) opts.onAuthRequired?.('limit')
        return
      }

      let data: { markdown_text?: string; file_type?: string; word_count?: number; message?: string; error?: string }
      try {
        data = await res.json() as typeof data
      } catch {
        setError('Conversion service returned an unexpected response. Try again.')
        setBatchStatus('idle')
        return
      }

      if (res.status === 401 && data.error === 'AUTH_REQUIRED') {
        setBatchStatus('idle')
        opts.onAuthRequired?.('feature')
        return
      }

      if (!res.ok || !data.markdown_text) {
        setError(data.message ?? 'Conversion failed. Please try again.')
        setBatchStatus('idle')
        track(EVENTS.fileConversionFailed, { source: 'url', error: data.message ?? 'Conversion failed' })
        return
      }

      const wordCount = data.word_count ?? data.markdown_text.split(/\s+/).filter(Boolean).length
      const fileType = data.file_type ?? 'html'
      const displayName = parsed.hostname.replace(/^www\./, '') + parsed.pathname.replace(/\/$/, '')

      setFiles([{
        id: crypto.randomUUID(),
        name: displayName,
        sourceUrl: trimmed,
        status: 'done',
        markdown: data.markdown_text,
        wordCount,
        fileType,
      }])
      setBatchStatus('done')
      track(EVENTS.fileConversionCompleted, { source: 'url', file_type: fileType, word_count: wordCount })

      if (user) {
        pendingInserts.current += 1
        setAutoSaveSettled(false)
        Promise.resolve(
          supabase
            .from("conversions")
            .insert({
              user_id: user.id,
              filename: displayName,
              file_type: fileType,
              word_count: wordCount,
              markdown_text: data.markdown_text,
              source_bytes: null, // URL conversions have no source file — excluded from ROI
            })
            .select("id")
            .single()
        )
          .then(({ data: row, error: insertError }) => {
            if (insertError) {
              console.error("[conversions] insert failed:", insertError.message)
              return
            }
            if (row?.id) {
              setFiles((prev) =>
                prev.map((fi) => (fi.markdown === data.markdown_text ? { ...fi, conversionId: row.id } : fi))
              )
            }
          })
          .finally(() => {
            pendingInserts.current -= 1
            if (pendingInserts.current <= 0) setAutoSaveSettled(true)
          })
      }
    } catch {
      setError('Network error. Check your connection and try again.')
      setBatchStatus('idle')
    }
  }

  const resetApp = () => {
    setFiles([])
    setBatchStatus('idle')
    setCopiedId(null)
    setShowMerged(false)
    setError(null)
    setIntakeNotices([])
    setRateLimited(false)
    setInputMode('upload')
    setUrl('')
    setResumeVaultAdd(false)
    setResumedFromPreview(false)
    setAutoSaveSettled(true)
    pendingInserts.current = 0
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleNewConversion = () => {
    resetApp()
    setTimeout(() => {
      fileInputRef.current?.click()
    }, 50)
  }

  const successfulFiles = useMemo(
    () => files.filter((fi) => fi.status === "done" && fi.markdown),
    [files]
  )

  const mergedMarkdown = useMemo(() => {
    const successFiles = files.filter(fi => fi.status === 'done' && fi.markdown)
    if (successFiles.length < 2) return null // Merge only makes sense for 2+ files — single file users use per-file copy/download
    return successFiles
      .map(fi => {
        const nameNoExt = fi.name.replace(/\.[^/.]+$/, '')
        return `# ${nameNoExt}\n\n${fi.markdown}`
      })
      .join('\n\n---\n\n')
  }, [files])

  // Guests hold only a truncated preview, so "Add to Vault" stashes the original
  // file and shows the sign-in wall; the full conversion is re-run after sign-in.
  const stashPendingVaultAdd = useCallback(() => {
    void requestFullResult("vault")
    return true
  }, [requestFullResult])

  const clearResumeVaultAdd = useCallback(() => setResumeVaultAdd(false), [])

  // After sign-in, pick up a guest's stashed file and convert it in full.
  // takePendingConversion() is destructive, so a consumed stash must never be dropped
  // (StrictMode runs this effect twice); the ref guard makes the take happen once.
  const takeStarted = useRef(false)
  useEffect(() => {
    if (!user) { takeStarted.current = false; return }
    if (takeStarted.current || batchStatus !== "idle" || files.length > 0) return
    takeStarted.current = true
    takePendingConversion().then((p) => {
      if (!p) return
      resumeSpin.current = true
      setResumeAction(p.action)
      setFiles([{
        id: crypto.randomUUID(),
        name: p.file.name,
        file: p.file,
        status: "queued",
        fileType: p.file.name.split(".").pop()?.toLowerCase(),
      }])
    })
    // One-shot on sign-in; batchStatus/files are guards, not triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Second half: once the restored file is in state, convert it (needs the fresh handleSpin closure).
  useEffect(() => {
    if (!resumeSpin.current || files.length !== 1 || batchStatus !== "idle") return
    resumeSpin.current = false
    void handleSpin()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, batchStatus])

  useEffect(() => {
    if (!resumeAction || batchStatus !== "done") return
    track(EVENTS.previewResumed, { action: resumeAction })
    setResumedFromPreview(true)
    if (resumeAction === "vault") setResumeVaultAdd(true)
    setResumeAction(null)
  }, [resumeAction, batchStatus])

  return {
    // auth
    user,
    // state
    files,
    batchStatus,
    copiedId,
    showMerged,
    isDragOver,
    error,
    intakeNotices,
    dismissIntakeNotices,
    inputMode,
    url,
    rateLimited,
    remaining,
    dailyLimit,
    appState,
    fileInputRef,
    mergedMarkdown,
    successfulFiles,
    resumeVaultAdd,
    autoSaveSettled,
    stashPendingVaultAdd,
    clearResumeVaultAdd,
    requestFullResult,
    isGuestPreview,
    resumedFromPreview,
    // setters
    setShowMerged,
    setError,
    setInputMode,
    setUrl,
    // handlers
    handleFiles,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handleBrowse,
    handleFileInput,
    removeFile,
    handleCopyFile,
    handleDownloadFile,
    handleSpin,
    handleConvertUrl,
    resetApp,
    handleNewConversion,
  }
}
