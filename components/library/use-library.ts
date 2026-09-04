"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import {
  createNote,
  createProject,
  deleteProject,
  deleteSpin,
  getSpin,
  listProjects,
  listSpinStats,
  listSpins,
  listTags,
  renameProject,
  updateSpin,
  removeFromVault,
  UNFILED,
  type Project,
  type Spin,
  type SpinStats,
  type TagCount,
  type UpdateSpinFields,
} from "@/lib/library"
import type { SummaryStatus } from "@/lib/vault/summary"

const PAGE = 100

export function useLibrary() {
  const { user, isLoading: authLoading } = useAuth()

  const [projects, setProjects] = useState<Project[]>([])
  const [tags, setTags] = useState<TagCount[]>([])
  const [stats, setStats] = useState<SpinStats>({ total: 0, unfiled: 0, byProject: {} })
  const [spins, setSpins] = useState<Spin[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [selectedProject, setSelectedProject] = useState<string | null>(null) // null = All
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("") // debounced

  // Pagination
  const [limit, setLimit] = useState(PAGE)
  const [hasMore, setHasMore] = useState(false)

  // Detail panel
  const [selectedSpinId, setSelectedSpinId] = useState<string | null>(null)
  // Holds a spin fetched on demand (e.g. opening a related doc not on the current page).
  const [selectedSpinExtra, setSelectedSpinExtra] = useState<Spin | null>(null)

  const fetchToken = useRef(0)

  // Debounce the search box into `query`
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  // Reset pagination whenever filters/search change
  useEffect(() => {
    setLimit(PAGE)
  }, [selectedProject, selectedTag, query])

  const refreshSidebars = useCallback(async () => {
    const [p, t, s] = await Promise.all([listProjects(), listTags(), listSpinStats()])
    setProjects(p)
    setTags(t)
    setStats(s)
  }, [])

  const fetchSpins = useCallback(async () => {
    const token = ++fetchToken.current
    setLoading(true)
    setError(null)
    try {
      const rows = await listSpins({
        projectId: selectedProject,
        tag: selectedTag,
        query,
        from: 0,
        to: limit - 1,
        inVault: true,
      })
      if (token !== fetchToken.current) return
      setSpins(rows)
      setHasMore(rows.length === limit)
    } catch (e) {
      if (token !== fetchToken.current) return
      setError(e instanceof Error ? e.message : "Failed to load your spins")
    } finally {
      if (token === fetchToken.current) setLoading(false)
    }
  }, [selectedProject, selectedTag, query, limit])

  // Initial load + reloads on filter/pagination changes
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      return
    }
    fetchSpins()
  }, [user, authLoading, fetchSpins])

  // Sidebars load once the user is known
  useEffect(() => {
    if (authLoading || !user) return
    refreshSidebars().catch(() => {})
  }, [user, authLoading, refreshSidebars])

  const loadMore = useCallback(() => setLimit((n) => n + PAGE), [])

  // ---- Mutations ----

  const addProject = useCallback(
    async (name: string) => {
      const created = await createProject(name)
      setProjects((prev) => [...prev, created])
      return created
    },
    []
  )

  const renameProjectById = useCallback(async (id: string, name: string) => {
    await renameProject(id, name)
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)))
  }, [])

  const removeProject = useCallback(
    async (id: string) => {
      await deleteProject(id)
      setProjects((prev) => prev.filter((p) => p.id !== id))
      if (selectedProject === id) setSelectedProject(null)
      await fetchSpins()
      await refreshSidebars()
    },
    [selectedProject, fetchSpins, refreshSidebars]
  )

  const saveSpin = useCallback(
    async (id: string, fields: UpdateSpinFields) => {
      // updateSpin returns the fresh row (word_count/updated_at/version recomputed
      // server-side when markdown_text changes) rather than us guessing at them.
      const updated = await updateSpin(id, fields)
      setSpins((prev) => prev.map((s) => (s.id === id ? { ...s, ...updated } : s)))
      setSelectedSpinExtra((prev) => (prev && prev.id === id ? { ...prev, ...updated } : prev))
      await refreshSidebars()
      // If the spin no longer matches the active project filter, drop it from the view.
      // Checked against `updated.project_ids` (derived from the just-saved conversions.project_id
      // column, via projectIdsFromColumn), not the save payload's singular `fields.project_id` —
      // a doc's true membership is what the filter cares about, not what was just requested.
      if (
        fields.project_id !== undefined &&
        ((selectedProject === UNFILED && updated.project_ids.length > 0) ||
          (selectedProject && selectedProject !== UNFILED && !updated.project_ids.includes(selectedProject)))
      ) {
        setSpins((prev) => prev.filter((s) => s.id !== id))
      }
    },
    [selectedProject, refreshSidebars]
  )

  // New note: a note IS a vault doc the instant it's created, so it's prepended
  // to the list and opened immediately — no separate draft state.
  const addNote = useCallback(async () => {
    const note = await createNote()
    setSpins((prev) => [note, ...prev])
    setSelectedSpinId(note.id)
    setSelectedSpinExtra(note) // already full content; no fetch needed
    await refreshSidebars()
    return note
  }, [refreshSidebars])

  const patchSpinSummary = useCallback(
    (id: string, fields: { summary: string; summary_status: SummaryStatus; summary_generated_at: string }) => {
      setSpins((prev) => prev.map((s) => (s.id === id ? { ...s, ...fields } : s)))
      setSelectedSpinExtra((prev) => (prev && prev.id === id ? { ...prev, ...fields } : prev))
    },
    []
  )

  const patchSpinBrief = useCallback((id: string, brief: string, briefGeneratedAt: string) => {
    setSpins((prev) => prev.map((s) => (s.id === id ? { ...s, brief, brief_generated_at: briefGeneratedAt } : s)))
    setSelectedSpinExtra((prev) =>
      prev && prev.id === id ? { ...prev, brief, brief_generated_at: briefGeneratedAt } : prev
    )
  }, [])

  const removeSpin = useCallback(
    async (id: string) => {
      await deleteSpin(id)
      setSpins((prev) => prev.filter((s) => s.id !== id))
      if (selectedSpinId === id) {
        setSelectedSpinId(null)
        setSelectedSpinExtra(null)
      }
      await refreshSidebars()
    },
    [selectedSpinId, refreshSidebars]
  )

  const removeSpinFromVault = useCallback(
    async (id: string) => {
      await removeFromVault(id)
      setSpins((prev) => prev.filter((s) => s.id !== id))
      if (selectedSpinId === id) {
        setSelectedSpinId(null)
        setSelectedSpinExtra(null)
      }
      await refreshSidebars()
    },
    [selectedSpinId, refreshSidebars]
  )

  // Prefer the fully-fetched record (has markdown_text) over the list row, which
  // never carries content now that list queries omit it. While the fetch in
  // openSpin is in flight, this still resolves to the list row so the panel opens
  // instantly with metadata — content fills in a beat later.
  const selectedSpin = useMemo(() => {
    if (selectedSpinExtra && selectedSpinExtra.id === selectedSpinId) return selectedSpinExtra
    return spins.find((s) => s.id === selectedSpinId) ?? null
  }, [spins, selectedSpinId, selectedSpinExtra])

  const openSpin = useCallback(async (id: string) => {
    setSelectedSpinId(id)
    setSelectedSpinExtra(null) // clear any previous doc's full record
    try {
      const fetched = await getSpin(id)
      setSelectedSpinExtra(fetched)
    } catch {
      setSelectedSpinExtra(null)
    }
  }, [])

  return {
    // data
    projects,
    tags,
    stats,
    spins,
    loading,
    error,
    // filters
    selectedProject,
    setSelectedProject,
    selectedTag,
    setSelectedTag,
    search,
    setSearch,
    // pagination
    hasMore,
    loadMore,
    // detail panel
    selectedSpin,
    openSpin,
    closeSpin: () => {
      setSelectedSpinId(null)
      setSelectedSpinExtra(null)
    },
    // mutations
    addNote,
    patchSpinSummary,
    addProject,
    renameProjectById,
    removeProject,
    saveSpin,
    patchSpinBrief,
    removeSpin,
    removeSpinFromVault,
    reload: fetchSpins,
  }
}
