"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import {
  computeFolderSummaries,
  createNote,
  createProject,
  deleteProject,
  deleteSpin,
  getSpin,
  listFolderRows,
  listProjects,
  listSpinStats,
  listSpins,
  listTags,
  descendantProjectIds,
  idsInRange,
  moveSpinsToProject,
  renameProject,
  setProjectColor,
  rollUpProjectCounts,
  updateSpin,
  removeFromVault,
  UNFILED,
  type FolderSummary,
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
  const [folders, setFolders] = useState<FolderSummary[]>([])
  // Bulk-move selection. Anchor is the last plainly-clicked row, so shift-click knows
  // which end of the range to extend from.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null)

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

  // ---- Derived project tree (one level: root -> subproject -> docs) ----
  const roots = useMemo(() => projects.filter((p) => !p.parent_id), [projects])
  const childrenByParent = useMemo(() => {
    const m = new Map<string, Project[]>()
    for (const p of projects) {
      if (!p.parent_id) continue
      const list = m.get(p.parent_id)
      if (list) list.push(p)
      else m.set(p.parent_id, [p])
    }
    return m
  }, [projects])

  // Selecting a root shows its subprojects' documents too; selecting a subproject (or
  // Unfiled) shows only its own, since a subproject can't have children.
  const descendantIds = useMemo(() => {
    if (!selectedProject || selectedProject === UNFILED) return []
    return descendantProjectIds(selectedProject, projects).filter((id) => id !== selectedProject)
  }, [selectedProject, projects])

  // Folder cards and root rail rows show rolled-up counts; subproject rows show direct.
  const statsRollup = useMemo(
    () => rollUpProjectCounts(stats.byProject, projects),
    [stats.byProject, projects]
  )

  // Debounce the search box into `query`
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  // Reset pagination whenever filters/search change
  useEffect(() => {
    setLimit(PAGE)
  }, [selectedProject, selectedTag, query])

  // Drop the selection when the visible set changes: acting on rows the user can no
  // longer see is the one genuinely dangerous failure mode for a bulk action.
  useEffect(() => {
    setSelectedIds(new Set())
    setSelectionAnchor(null)
  }, [selectedProject, selectedTag, query])

  const refreshSidebars = useCallback(async () => {
    // Folder rows are fetched alongside the rest rather than after listProjects, then
    // folded locally — computeFolderSummaries only needs the project ids, so there's no
    // reason to serialise the two requests.
    const [p, t, s, folderRows] = await Promise.all([
      listProjects(),
      listTags(),
      listSpinStats(),
      listFolderRows(),
    ])
    setProjects(p)
    setTags(t)
    setStats(s)
    setFolders(computeFolderSummaries(folderRows, p))
  }, [])

  const fetchSpins = useCallback(async () => {
    const token = ++fetchToken.current
    setLoading(true)
    setError(null)
    try {
      const rows = await listSpins({
        projectId: selectedProject,
        descendantIds,
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
  }, [selectedProject, descendantIds, selectedTag, query, limit])

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
    async (name: string, parentId?: string | null) => {
      const created = await createProject(name, null, parentId ?? null)
      setProjects((prev) => [...prev, created])
      return created
    },
    []
  )

  const renameProjectById = useCallback(async (id: string, name: string) => {
    await renameProject(id, name)
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)))
  }, [])

  const setProjectColorById = useCallback(async (id: string, color: string | null) => {
    await setProjectColor(id, color)
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, color } : p)))
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
      // Compared against the resolved subtree, not selectedProject alone: moving a doc
      // from "Plato PM" into its "Saheed" subproject still matches the active root
      // filter, and dropping it there would make it look like it vanished.
      const visibleProjectIds =
        selectedProject && selectedProject !== UNFILED
          ? [selectedProject, ...descendantIds]
          : []
      if (
        fields.project_id !== undefined &&
        ((selectedProject === UNFILED && updated.project_ids.length > 0) ||
          (visibleProjectIds.length > 0 &&
            !updated.project_ids.some((pid) => visibleProjectIds.includes(pid))))
      ) {
        setSpins((prev) => prev.filter((s) => s.id !== id))
      }
    },
    [selectedProject, descendantIds, refreshSidebars]
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

  // ---- Bulk selection ----

  const toggleSelect = useCallback(
    (id: string, shiftKey = false) => {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (shiftKey && selectionAnchor) {
          // Shift-click extends from the anchor and always ADDS — matching how file
          // managers behave, and avoiding a range that silently deselects half of itself.
          for (const rid of idsInRange(spins.map((s) => s.id), selectionAnchor, id)) {
            next.add(rid)
          }
          return next
        }
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
      if (!shiftKey) setSelectionAnchor(id)
    },
    [spins, selectionAnchor]
  )

  const selectAllVisible = useCallback(() => {
    setSelectedIds(new Set(spins.map((s) => s.id)))
  }, [spins])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    setSelectionAnchor(null)
  }, [])

  /** Move every selected document into a project (null = Unfiled), then reload.
   *  Reload rather than patch in place: the moved rows may no longer match the active
   *  filter, and re-deriving that here would duplicate saveSpin's subtree logic. */
  const moveSelectedTo = useCallback(
    async (projectId: string | null) => {
      const ids = Array.from(selectedIds)
      if (ids.length === 0) return
      await moveSpinsToProject(ids, projectId)
      clearSelection()
      await fetchSpins()
      await refreshSidebars()
    },
    [selectedIds, clearSelection, fetchSpins, refreshSidebars]
  )

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
    roots,
    childrenByParent,
    statsRollup,
    tags,
    stats,
    spins,
    folders,
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
    // bulk selection
    selectedIds,
    toggleSelect,
    selectAllVisible,
    clearSelection,
    moveSelectedTo,
    // mutations
    addNote,
    patchSpinSummary,
    addProject,
    renameProjectById,
    setProjectColorById,
    removeProject,
    saveSpin,
    patchSpinBrief,
    removeSpin,
    removeSpinFromVault,
    reload: fetchSpins,
  }
}
