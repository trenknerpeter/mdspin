"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import {
  fetchDashboardRows,
  computeDashboardStats,
  computeActivitySeries,
  type DashboardRow,
} from "@/lib/dashboard"
import {
  listSpins,
  listSpinStats,
  listProjects,
  type Spin,
  type Project,
  type SpinStats,
} from "@/lib/library"

const EMPTY_STATS: SpinStats = { total: 0, unfiled: 0, byProject: {} }

export function useDashboard() {
  const { user } = useAuth()
  const [rows, setRows] = useState<DashboardRow[]>([])
  const [recent, setRecent] = useState<Spin[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [spinStats, setSpinStats] = useState<SpinStats>(EMPTY_STATS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [r, rec, proj, stats] = await Promise.all([
        fetchDashboardRows(),
        listSpins({ from: 0, to: 7 }), // recent 8 across all conversions (not vault-only)
        listProjects(),
        listSpinStats(),
      ])
      setRows(r)
      setRecent(rec)
      setProjects(proj)
      setSpinStats(stats)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) load()
  }, [user, load])

  const stats = useMemo(() => computeDashboardStats(rows), [rows])
  const activity = useMemo(() => computeActivitySeries(rows), [rows])

  return { user, loading, error, reload: load, rows, recent, projects, spinStats, stats, activity }
}
