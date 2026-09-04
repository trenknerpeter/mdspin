"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import {
  fetchDashboardRows,
  computeDashboardStats,
  computeCumulativeSavings,
  computeVaultPulse,
  computeProjectActivity,
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

// Savings figure shown in the thin conversion band. The interactive calls/mo
// input that used to live here now lives on History, next to the full panel.
const BAND_MONTHLY_CALLS = 20

export function useDashboard() {
  const { user } = useAuth()
  const [rows, setRows] = useState<DashboardRow[]>([])
  const [vaultDocs, setVaultDocs] = useState<Spin[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [spinStats, setSpinStats] = useState<SpinStats>(EMPTY_STATS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [r, docs, proj, stats] = await Promise.all([
        fetchDashboardRows(),
        // One 50-row window of the newest vault docs powers the pulse,
        // recently-added, and per-project last-activity blocks.
        listSpins({ inVault: true, from: 0, to: 49 }),
        listProjects(),
        listSpinStats(),
      ])
      setRows(r)
      setVaultDocs(docs)
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
  const savings = useMemo(() => computeCumulativeSavings(rows, BAND_MONTHLY_CALLS), [rows])
  const pulse = useMemo(() => computeVaultPulse(vaultDocs), [vaultDocs])
  const projectActivity = useMemo(() => computeProjectActivity(vaultDocs), [vaultDocs])

  return {
    user,
    loading,
    error,
    reload: load,
    rows,
    vaultDocs,
    projects,
    spinStats,
    stats,
    savings,
    pulse,
    projectActivity,
  }
}
