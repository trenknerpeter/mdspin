"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import posthog from "posthog-js"
import { listProjects, type Project } from "@/lib/library"
import { createClient } from "@/lib/supabase/client"
import { type IngestDoc, type IngestOutcome } from "@/lib/vault/ingest"
import { planIngest, type HashedIngestFile, type IngestSettings } from "@/lib/vault/plan"
import { contentHash } from "@/lib/vault/hash"
import { chunkBySize } from "@/lib/vault/chunk"
import type { FolderMappingMode } from "@/lib/vault/paths"
import {
  checkExistingContentHashes,
  resolveProjectIds,
  insertIngestRows,
  type PreparedIngestRow,
} from "@/lib/vault/commit"
import { SCAN_CONCURRENCY, COMMIT_CHUNK_MAX_BYTES, COMMIT_CHUNK_MAX_COUNT, MAX_IMPORT_FILES } from "@/lib/vault/limits"

export type IngestPhase = "idle" | "scanning" | "review" | "importing" | "done"

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

const EMPTY_OUTCOME: IngestOutcome = {
  ready: 0,
  skipped: {
    too_large: 0,
    empty: 0,
    duplicate_in_batch: 0,
    already_in_vault: 0,
    ignored_path: 0,
    unsupported_type: 0,
  },
  totalSkipped: 0,
}

export function useVaultIngest() {
  const [phase, setPhase] = useState<IngestPhase>("idle")
  const [scanProgress, setScanProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 })
  const [scanError, setScanError] = useState<string | null>(null)

  // One object, not three parallel useState values — mode/defaultProjectNames/defaultTags
  // are only ever read or changed together, and planIngest takes them as a single opts arg.
  const [settings, setSettings] = useState<IngestSettings>({ mode: "top-folder-project" })
  const [projects, setProjects] = useState<Project[]>([])

  // Populated once per scan; readyDocs/outcome are then a pure function of these two plus
  // settings, recomputed by useMemo below instead of an imperative rebuild().
  const [scannedFiles, setScannedFiles] = useState<HashedIngestFile[]>([])
  const [existingHashes, setExistingHashes] = useState<Set<string>>(new Set())

  const [committed, setCommitted] = useState(0)
  const [failedDocs, setFailedDocs] = useState<IngestDoc[]>([])

  const source = useRef<"files" | "folder" | "paste">("files")

  const plan = useMemo(
    () => (scannedFiles.length > 0 ? planIngest(scannedFiles, settings, existingHashes) : { readyDocs: [], outcome: EMPTY_OUTCOME }),
    [scannedFiles, settings, existingHashes]
  )
  const readyDocs = plan.readyDocs
  const outcome = plan.outcome

  const scan = useCallback(
    async (files: File[], via: "files" | "folder" | "paste" = "files") => {
      if (files.length > MAX_IMPORT_FILES) {
        setPhase("idle")
        setScanError(`Too many files to import at once — please choose ${MAX_IMPORT_FILES} or fewer.`)
        return
      }

      source.current = via
      setPhase("scanning")
      setScanError(null)
      setScanProgress({ done: 0, total: files.length })

      try {
        const [proj, read] = await Promise.all([
          listProjects(),
          mapWithConcurrency(files, SCAN_CONCURRENCY, async (file) => {
            const text = await file.text()
            setScanProgress((p) => ({ ...p, done: p.done + 1 }))
            return {
              filename: file.name,
              relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || null,
              text,
            }
          }),
        ])
        setProjects(proj)

        const hashes = await Promise.all(read.map((f) => contentHash(f.text)))
        setScannedFiles(read.map((f, i) => ({ ...f, hash: hashes[i] })))
        setExistingHashes(await checkExistingContentHashes(hashes.filter((h): h is string => !!h)))
        setPhase("review")
      } catch (e) {
        setScanError(e instanceof Error ? e.message : "Couldn't read those files.")
        setPhase("idle")
      }
    },
    []
  )

  const scanPasted = useCallback(
    async (text: string, filename = "pasted-note.md") => {
      const file = new File([text], filename, { type: "text/markdown" })
      await scan([file], "paste")
    },
    [scan]
  )

  const setMode = useCallback((mode: FolderMappingMode) => {
    setSettings((s) => ({ ...s, mode }))
  }, [])
  const setDefaultProjectName = useCallback((name: string | null) => {
    setSettings((s) => ({ ...s, defaultProjectNames: name ? [name] : undefined }))
  }, [])
  const setDefaultTags = useCallback((tags: string[]) => {
    setSettings((s) => ({ ...s, defaultTags: tags }))
  }, [])

  const commitDocs = useCallback(
    async (docs: IngestDoc[]) => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const allProjectNames = docs.flatMap((d) => d.projectNames.slice(0, 1))
      const projectIdByName = await resolveProjectIds(allProjectNames, projects)

      const prepared: PreparedIngestRow[] = docs.map((d) => ({
        ...d.row,
        user_id: user.id,
        project_id: d.projectNames[0] ? (projectIdByName.get(d.projectNames[0]) ?? null) : null,
      }))

      const chunks = chunkBySize(prepared, {
        maxCount: COMMIT_CHUNK_MAX_COUNT,
        maxBytes: COMMIT_CHUNK_MAX_BYTES,
      })

      const stillFailed: IngestDoc[] = []
      let okCount = 0
      let chunkStart = 0
      for (const chunk of chunks) {
        const chunkDocs = docs.slice(chunkStart, chunkStart + chunk.length)
        chunkStart += chunk.length
        try {
          const result = await insertIngestRows(chunk)
          okCount += result.insertedIds.length + result.skippedDuplicateCount
          setCommitted((c) => c + result.insertedIds.length + result.skippedDuplicateCount)
        } catch {
          stillFailed.push(...chunkDocs)
        }
      }

      setFailedDocs(stillFailed)
      setPhase("done")
      // Deliberately NOT file_conversion_* — these docs never touched the
      // conversion backend, and that event feeds the dashboard's "words
      // converted" metric via lib/dashboard.ts's source_type segmentation.
      if (okCount > 0) {
        posthog.capture("vault_document_ingested", { source_type: docs[0]?.row.source_type, count: okCount, via: source.current })
      }
      return okCount
    },
    [projects]
  )

  const commit = useCallback(async () => {
    setCommitted(0)
    setFailedDocs([])
    setPhase("importing")
    await commitDocs(readyDocs)
  }, [readyDocs, commitDocs])

  const retryFailed = useCallback(async () => {
    const toRetry = failedDocs
    setFailedDocs([])
    setPhase("importing")
    await commitDocs(toRetry)
  }, [failedDocs, commitDocs])

  const reset = useCallback(() => {
    setPhase("idle")
    setScannedFiles([])
    setExistingHashes(new Set())
    setCommitted(0)
    setFailedDocs([])
    setScanError(null)
  }, [])

  const projectNameOptions = useMemo(
    () => Array.from(new Set(projects.map((p) => p.name))).sort(),
    [projects]
  )

  return {
    phase,
    scanProgress,
    scanError,
    mode: settings.mode,
    setMode,
    defaultProjectName: settings.defaultProjectNames?.[0] ?? null,
    setDefaultProjectName,
    defaultTags: settings.defaultTags ?? [],
    setDefaultTags,
    projects,
    projectNameOptions,
    readyDocs,
    outcome,
    committed,
    committing: phase === "importing",
    failedDocs,
    totalToCommit: readyDocs.length,
    scan,
    scanPasted,
    commit,
    retryFailed,
    reset,
  }
}
