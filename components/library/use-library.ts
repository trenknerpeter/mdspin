"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import {
  createProject,
  deleteProject,
  deleteSpin,
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
} from "@/lib/library"

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
    async (id: string, fields: { title?: string | null; project_id?: string | null; tags?: string[] }) => {
      await updateSpin(id, fields)
      setSpins((prev) => prev.map((s) => (s.id === id ? { ...s, ...fields } : s)))
      await refreshSidebars()
      // If the spin no longer matches the active project filter, drop it from the view.
      if (
        fields.project_id !== undefined &&
        ((selectedProject === UNFILED && fields.project_id !== null) ||
          (selectedProject && selectedProject !== UNFILED && fields.project_id !== selectedProject))
      ) {
        setSpins((prev) => prev.filter((s) => s.id !== id))
      }
    },
    [selectedProject, refreshSidebars]
  )

  const removeSpin = useCallback(
    async (id: string) => {
      await deleteSpin(id)
      setSpins((prev) => prev.filter((s) => s.id !== id))
      if (selectedSpinId === id) setSelectedSpinId(null)
      await refreshSidebars()
    },
    [selectedSpinId, refreshSidebars]
  )

  const removeSpinFromVault = useCallback(
    async (id: string) => {
      await removeFromVault(id)
      setSpins((prev) => prev.filter((s) => s.id !== id))
      if (selectedSpinId === id) setSelectedSpinId(null)
      await refreshSidebars()
    },
    [selectedSpinId, refreshSidebars]
  )

  const selectedSpin = useMemo(
    () => spins.find((s) => s.id === selectedSpinId) ?? null,
    [spins, selectedSpinId]
  )

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
    openSpin: setSelectedSpinId,
    closeSpin: () => setSelectedSpinId(null),
    // mutations
    addProject,
    renameProjectById,
    removeProject,
    saveSpin,
    removeSpin,
    removeSpinFromVault,
    reload: fetchSpins,
  }
}
