"use client"

import { useState, useRef, useMemo, useCallback, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase/client"
import posthog from "posthog-js"
import { isSupportedExt } from "@/lib/formats"
import type { FileItem, ConverterContext, ConversionOptions } from "./types"

const STASH_KEY = "mdspin:pendingVaultAdd"
const STASH_TTL = 60 * 60 * 1000 // 1 hour
const STASH_MAX = 2 * 1024 * 1024 // ~2 MB of JSON

export function useConverter(opts: {
  context: ConverterContext
  options?: ConversionOptions
  onAuthRequired?: () => void
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  // --- input mode state ---
  const [inputMode, setInputMode] = useState<'upload' | 'url'>('upload')
  const [url, setUrl] = useState('')

  // --- rate limit state ---
  const [rateLimited, setRateLimited] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [dailyLimit, setDailyLimit] = useState<number | null>(null)

  const [resumeVaultAdd, setResumeVaultAdd] = useState(false)
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
  const handleFiles = useCallback((newFiles: File[]) => {
    const MAX_SIZE = 20 * 1024 * 1024

    const toAdd = newFiles.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
      if (!isSupportedExt(ext)) return false
      if (f.size > MAX_SIZE) return false
      return true
    })

    setFiles(prev => {
      const existing = new Set(prev.map(fi => fi.file ? fi.file.name + String(fi.file.size) : fi.id))
      const deduped = toAdd.filter(f => !existing.has(f.name + String(f.size)))
      const combined = [...prev, ...deduped.map(f => ({
        id: crypto.randomUUID(),
        name: f.name,
        file: f,
        status: 'queued' as const,
        fileType: f.name.split('.').pop()?.toLowerCase()
      }))]
      return combined.slice(0, 20)
    })
  }, [])

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
    posthog.capture("markdown_copied", { source: "converter" })
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDownloadFile = (filename: string, markdown: string) => {
    posthog.capture("markdown_downloaded", { source: "converter", filename })
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
    }))

    posthog.capture("file_conversion_started", {
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
        if (!user) opts.onAuthRequired?.()
        return
      }

      // Now safe to parse JSON
      let data: { results?: Array<{ success: boolean; markdown_text?: string; error?: string }>; message?: string; error?: string }
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
        opts.onAuthRequired?.()
        return
      }

      if (!res.ok) {
        setError(data.message ?? 'Conversion failed. Please try again.')
        setBatchStatus('idle')
        setFiles(prev => prev.map(fi => ({ ...fi, status: 'queued' as const })))
        return
      }

      // Map results back to FileItems
      // Backend returns { success: boolean, markdown_text?: string, error?: string, ... } per entry
      const results: Array<{ success: boolean; markdown_text?: string; error?: string }> = data.results ?? []
      // Results are positional: the backend preserves submission order
      setFiles(prev => prev.map((fi, idx) => {
        const result = results[idx]
        if (!result) return { ...fi, status: 'failed' as const, error: 'No result returned' }
        if (result.success && result.markdown_text) {
          const wordCount = result.markdown_text.split(/\s+/).filter(Boolean).length
          return {
            ...fi,
            status: 'done' as const,
            markdown: result.markdown_text,
            wordCount,
          }
        }
        return {
          ...fi,
          status: 'failed' as const,
          error: result.error ?? 'Conversion failed',
        }
      }))

      results.forEach((result, idx) => {
        const fi = files[idx]
        const ext = fi?.name.split('.').pop()?.toLowerCase()
        if (result.success && result.markdown_text) {
          const wordCount = result.markdown_text.split(/\s+/).filter(Boolean).length
          posthog.capture("file_conversion_completed", { source: 'upload', file_type: ext, word_count: wordCount })
        } else {
          posthog.capture("file_conversion_failed", { source: 'upload', file_type: ext, error: result.error ?? 'Conversion failed' })
        }
      })
      setBatchStatus('done')

      // Auto-save to history — signed-in users only. Capture row ids for "Add to Vault".
      if (user) {
        const insertCount = results.filter(
          (r, idx) => r.success && r.markdown_text && fileMetaForInserts[idx]
        ).length
        if (insertCount > 0) {
          pendingInserts.current = insertCount
          setAutoSaveSettled(false)
        }
        results.forEach((result, idx) => {
          if (!(result.success && result.markdown_text)) return
          const meta = fileMetaForInserts[idx]
          if (!meta) return
          const wordCount = result.markdown_text.split(/\s+/).filter(Boolean).length
          Promise.resolve(
            supabase
              .from("conversions")
              .insert({
                user_id: user.id,
                filename: meta.name,
                file_type: meta.ext,
                word_count: wordCount,
                markdown_text: result.markdown_text,
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

    posthog.capture('file_conversion_started', { file_count: 1, source: 'url' })
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
        if (!user) opts.onAuthRequired?.()
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
        opts.onAuthRequired?.()
        return
      }

      if (!res.ok || !data.markdown_text) {
        setError(data.message ?? 'Conversion failed. Please try again.')
        setBatchStatus('idle')
        posthog.capture('file_conversion_failed', { source: 'url', error: data.message ?? 'Conversion failed' })
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
      posthog.capture('file_conversion_completed', { source: 'url', file_type: fileType, word_count: wordCount })

      if (user) {
        pendingInserts.current = 1
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
    setRateLimited(false)
    setInputMode('upload')
    setUrl('')
    setResumeVaultAdd(false)
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

  const stashPendingVaultAdd = useCallback(
    (tags: string[]) => {
      try {
        const payload = JSON.stringify({
          files: successfulFiles.map((fi) => ({
            name: fi.name,
            file_type: fi.fileType ?? "md",
            word_count: fi.wordCount ?? null,
            markdown: fi.markdown,
          })),
          tags,
          createdAt: Date.now(),
        })
        if (payload.length > STASH_MAX) return false
        localStorage.setItem(STASH_KEY, payload)
        return true
      } catch {
        return false
      }
    },
    [successfulFiles]
  )

  const clearResumeVaultAdd = useCallback(() => {
    setResumeVaultAdd(false)
    try {
      localStorage.removeItem(STASH_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  // Resume a pending anonymous "Add to Vault" after sign-in.
  useEffect(() => {
    if (!user) return
    // Don't clobber an active/just-finished conversion the user is already working with.
    if (batchStatus !== "idle") return
    let parsed: {
      files?: Array<{ name: string; file_type: string; word_count: number | null; markdown: string }>
      tags?: string[]
      createdAt?: number
    }
    try {
      const raw = localStorage.getItem(STASH_KEY)
      if (!raw) return
      parsed = JSON.parse(raw)
    } catch {
      try { localStorage.removeItem(STASH_KEY) } catch {}
      return
    }
    if (!parsed.files?.length || !parsed.createdAt || Date.now() - parsed.createdAt > STASH_TTL) {
      try { localStorage.removeItem(STASH_KEY) } catch {}
      return
    }
    setFiles(
      parsed.files.map((f) => ({
        id: crypto.randomUUID(),
        name: f.name,
        status: "done" as const,
        markdown: f.markdown,
        wordCount: f.word_count ?? undefined,
        fileType: f.file_type,
      }))
    )
    setBatchStatus("done")
    setResumeVaultAdd(true)
    // Intentionally only re-run on sign-in; batchStatus is read as a one-shot guard, not a trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

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
