"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import posthog from "posthog-js"
import { listProjects, type Project } from "@/lib/library"
import { createClient } from "@/lib/supabase/client"
import {
  buildIngestDoc,
  dedupeWithinBatch,
  summarizeIngestOutcome,
  type IngestDoc,
  type SkippedFile,
  type IngestOutcome,
} from "@/lib/vault/ingest"
import { contentHash } from "@/lib/vault/hash"
import { chunkBySize } from "@/lib/vault/chunk"
import type { FolderMappingMode } from "@/lib/vault/paths"
import {
  checkExistingContentHashes,
  resolveProjectIds,
  insertIngestRows,
  type PreparedIngestRow,
} from "@/lib/vault/commit"
import {
  SCAN_CONCURRENCY,
  COMMIT_CHUNK_MAX_BYTES,
  COMMIT_CHUNK_MAX_COUNT,
  isIngestExt,
} from "@/lib/vault/limits"

export type IngestPhase = "idle" | "scanning" | "review" | "importing" | "done"

interface RawFile {
  filename: string
  relativePath: string | null
  text: string
}

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

export function useVaultIngest() {
  const [phase, setPhase] = useState<IngestPhase>("idle")
  const [scanProgress, setScanProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 })
  const [mode, setMode] = useState<FolderMappingMode>("top-folder-project")
  const [defaultProjectName, setDefaultProjectName] = useState<string | null>(null)
  const [defaultTags, setDefaultTags] = useState<string[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [readyDocs, setReadyDocs] = useState<IngestDoc[]>([])
  const [outcome, setOutcome] = useState<IngestOutcome>({
    ready: 0,
    skipped: { too_large: 0, empty: 0, duplicate_in_batch: 0, already_in_vault: 0, ignored_path: 0 },
    totalSkipped: 0,
  })
  const [scanError, setScanError] = useState<string | null>(null)

  const [committed, setCommitted] = useState(0)
  const [failedDocs, setFailedDocs] = useState<IngestDoc[]>([])
  const [committing, setCommitting] = useState(false)

  const rawFiles = useRef<RawFile[]>([])
  const source = useRef<"files" | "folder" | "paste">("files")
  const hashByIndex = useRef<(string | null)[]>([])
  const existingHashes = useRef<Set<string>>(new Set())

  // Pure rebuild from cached raw files + hashes — no network. Runs on scan and
  // whenever mode/defaults change, so tweaking the mapping mode is instant.
  const rebuild = useCallback(() => {
    const opts = {
      mode,
      defaultProjectNames: defaultProjectName ? [defaultProjectName] : undefined,
      defaultTags,
    }
    const skipped: SkippedFile[] = []
    const built: IngestDoc[] = []

    rawFiles.current.forEach((f, i) => {
      const result = buildIngestDoc(f, opts)
      if ("skip" in result) {
        skipped.push({ filename: f.filename, relativePath: f.relativePath, title: f.filename, reason: result.skip })
        return
      }
      const hash = hashByIndex.current[i]
      result.doc.row.content_hash = hash
      if (hash && existingHashes.current.has(hash)) {
        skipped.push({
          filename: f.filename,
          relativePath: f.relativePath,
          title: result.doc.row.title,
          reason: "already_in_vault",
        })
        return
      }
      built.push(result.doc)
    })

    const { kept, skipped: batchDupes } = dedupeWithinBatch(built)
    const allSkipped = [...skipped, ...batchDupes]
    setReadyDocs(kept)
    setOutcome(summarizeIngestOutcome(kept.length, allSkipped))
  }, [mode, defaultProjectName, defaultTags])

  const scan = useCallback(
    async (files: File[], via: "files" | "folder" | "paste" = "files") => {
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
            } satisfies RawFile
          }),
        ])
        setProjects(proj)
        rawFiles.current = read
        hashByIndex.current = await Promise.all(read.map((f) => contentHash(f.text)))
        existingHashes.current = await checkExistingContentHashes(
          hashByIndex.current.filter((h): h is string => !!h)
        )
        rebuild()
        setPhase("review")
      } catch (e) {
        setScanError(e instanceof Error ? e.message : "Couldn't read those files.")
        setPhase("idle")
      }
    },
    [rebuild]
  )

  const scanPasted = useCallback(
    async (text: string, filename = "pasted-note.md") => {
      const file = new File([text], filename, { type: "text/markdown" })
      await scan([file], "paste")
    },
    [scan]
  )

  const setModeAndRebuild = useCallback(
    (m: FolderMappingMode) => {
      setMode(m)
    },
    []
  )
  const setDefaultProjectAndRebuild = useCallback((name: string | null) => {
    setDefaultProjectName(name)
  }, [])
  const setDefaultTagsAndRebuild = useCallback((tags: string[]) => {
    setDefaultTags(tags)
  }, [])

  // Recompute whenever mode/defaults change post-scan (cheap, pure, no network).
  const modeRef = useRef(mode)
  const defaultProjectRef = useRef(defaultProjectName)
  const defaultTagsRef = useRef(defaultTags)
  if (
    phase === "review" &&
    (modeRef.current !== mode || defaultProjectRef.current !== defaultProjectName || defaultTagsRef.current !== defaultTags)
  ) {
    modeRef.current = mode
    defaultProjectRef.current = defaultProjectName
    defaultTagsRef.current = defaultTags
    rebuild()
  }

  const commitDocs = useCallback(
    async (docs: IngestDoc[]) => {
      setCommitting(true)
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setCommitting(false)
        return
      }

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
      setCommitting(false)
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
    setReadyDocs([])
    setCommitted(0)
    setFailedDocs([])
    setScanError(null)
    rawFiles.current = []
    hashByIndex.current = []
    existingHashes.current = new Set()
  }, [])

  const projectNameOptions = useMemo(
    () => Array.from(new Set(projects.map((p) => p.name))).sort(),
    [projects]
  )

  return {
    phase,
    scanProgress,
    scanError,
    mode,
    setMode: setModeAndRebuild,
    defaultProjectName,
    setDefaultProjectName: setDefaultProjectAndRebuild,
    defaultTags,
    setDefaultTags: setDefaultTagsAndRebuild,
    projects,
    projectNameOptions,
    readyDocs,
    outcome,
    committed,
    committing,
    failedDocs,
    totalToCommit: readyDocs.length,
    scan,
    scanPasted,
    commit,
    retryFailed,
    reset,
  }
}
