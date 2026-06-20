"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { Search, FileText, ArrowUpRight, X } from "lucide-react"
import { getKnowledgeGraph, type KnowledgeGraph, type GraphNode } from "@/lib/graph"

// ForceGraph2D pulls in canvas/d3 — must be client-only (no SSR) in App Router.
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false })

// react-force-graph mutates node objects in place with layout coordinates.
type PositionedNode = GraphNode & { x?: number; y?: number }

export function KnowledgeGraph() {
  const [graph, setGraph] = useState<KnowledgeGraph>({ nodes: [], links: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getKnowledgeGraph()
      .then((g) => {
        if (!cancelled) setGraph(g)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to build graph")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Keep the canvas sized to its container.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight })
    })
    ro.observe(el)
    setSize({ width: el.clientWidth, height: el.clientHeight })
    return () => ro.disconnect()
  }, [loading])

  const nodeById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes])

  // Adjacency for the selected-node neighbor list.
  const neighbors = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const l of graph.links) {
      const s = typeof l.source === "string" ? l.source : (l.source as GraphNode).id
      const t = typeof l.target === "string" ? l.target : (l.target as GraphNode).id
      if (!map.has(s)) map.set(s, new Set())
      if (!map.has(t)) map.set(t, new Set())
      map.get(s)!.add(t)
      map.get(t)!.add(s)
    }
    return map
  }, [graph.links])

  const focusNode = useCallback((id: string) => {
    setSelectedId(id)
    const n = (graph.nodes as PositionedNode[]).find((x) => x.id === id)
    if (n && n.x != null && n.y != null && fgRef.current) {
      fgRef.current.centerAt(n.x, n.y, 600)
      fgRef.current.zoom(4, 600)
    }
  }, [graph.nodes])

  const searchMatches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return graph.nodes.filter((n) => n.label.toLowerCase().includes(q)).slice(0, 8)
  }, [search, graph.nodes])

  const selected = selectedId ? nodeById.get(selectedId) : null
  const selectedNeighbors = selectedId ? Array.from(neighbors.get(selectedId) ?? []) : []

  // Distinct communities for the legend.
  const communities = useMemo(() => {
    const m = new Map<string, string>()
    for (const n of graph.nodes) if (!m.has(n.community)) m.set(n.community, n.color)
    return Array.from(m.entries())
  }, [graph.nodes])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <svg className="h-6 w-6 animate-spin text-[#FF4800]" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[#FF4800]/30 bg-[#161616] p-12 text-center">
        <p className="text-sm text-[#FF4800]">Couldn&apos;t build your graph: {error}</p>
      </div>
    )
  }

  if (graph.nodes.length < 2 || graph.links.length === 0) {
    return (
      <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-12 text-center">
        <FileText className="mx-auto mb-3 h-8 w-8 text-[#4A4A46]" />
        <p className="text-sm text-[#888480]">Your map needs a few connected spins to come alive.</p>
        <p className="mt-1 text-sm text-[#888480]">
          Add more files to your Vault — connections form automatically from shared topics.
        </p>
        <Link
          href="/app"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#FF4800] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#e04200]"
        >
          Convert a file
        </Link>
      </div>
    )
  }

  return (
    <div className="flex h-[70vh] gap-4">
      {/* Graph canvas */}
      <div ref={wrapRef} className="relative min-w-0 flex-1 overflow-hidden rounded-xl border border-[#2A2A2A] bg-[#0C0C0C]">
        {/* Search */}
        <div className="absolute left-3 top-3 z-10 w-64">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#4A4A46]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search nodes…"
              className="w-full rounded-lg border border-[#2A2A2A] bg-[#161616]/90 py-1.5 pl-8 pr-3 text-xs text-[#F0EDE8] placeholder:text-[#4A4A46] backdrop-blur focus:border-[#4A4A46] focus:outline-none"
            />
          </div>
          {searchMatches.length > 0 && (
            <ul className="mt-1 overflow-hidden rounded-lg border border-[#2A2A2A] bg-[#161616]">
              {searchMatches.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => {
                      focusNode(n.id)
                      setSearch("")
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-[#F0EDE8] transition-colors hover:bg-[#1E1E1E]"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: n.color }} />
                    <span className="truncate">{n.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Legend */}
        {communities.length > 0 && (
          <div className="absolute bottom-3 left-3 z-10 max-w-[40%] rounded-lg border border-[#2A2A2A] bg-[#161616]/80 px-3 py-2 backdrop-blur">
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.15em] text-[#4A4A46]">Communities</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {communities.map(([name, color]) => (
                <span key={name} className="inline-flex items-center gap-1.5 text-[10px] text-[#888480]">
                  <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {size.width > 0 && (
          <ForceGraph2D
            ref={fgRef}
            width={size.width}
            height={size.height}
            graphData={graph}
            backgroundColor="#0C0C0C"
            nodeId="id"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            nodeLabel={(n: any) => (n as GraphNode).label}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            nodeColor={(n: any) => (selectedId === (n as GraphNode).id ? "#FFFFFF" : (n as GraphNode).color)}
            nodeRelSize={4}
            linkColor={() => "#2A2A2A"}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            linkWidth={(l: any) => 0.5 + (l.weight ?? 0) * 2}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onNodeClick={(n: any) => focusNode((n as GraphNode).id)}
            onBackgroundClick={() => setSelectedId(null)}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            nodeCanvasObjectMode={() => "after"}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, scale: number) => {
              const n = node as PositionedNode
              if (scale < 1.6 && selectedId !== n.id) return
              const label = n.label
              const fontSize = 12 / scale
              ctx.font = `${fontSize}px sans-serif`
              ctx.fillStyle = "#888480"
              ctx.textAlign = "center"
              ctx.textBaseline = "top"
              ctx.fillText(label.length > 28 ? label.slice(0, 27) + "…" : label, n.x ?? 0, (n.y ?? 0) + 5 / scale)
            }}
          />
        )}
      </div>

      {/* Node info panel */}
      <aside className="w-72 shrink-0 overflow-y-auto rounded-xl border border-[#2A2A2A] bg-[#161616] p-4">
        {selected ? (
          <>
            <div className="mb-3 flex items-start justify-between gap-2">
              <h2 className="font-[family-name:var(--font-syne)] text-base font-bold leading-snug text-[#F0EDE8]">
                {selected.label}
              </h2>
              <button
                onClick={() => setSelectedId(null)}
                className="shrink-0 text-[#4A4A46] transition-colors hover:text-[#F0EDE8]"
                aria-label="Clear selection"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-[#4A4A46]">Type</dt>
                <dd className="text-[#888480]">{selected.fileType || "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#4A4A46]">Community</dt>
                <dd className="inline-flex items-center gap-1.5 text-[#888480]">
                  <span className="h-2 w-2 rounded-full" style={{ background: selected.color }} />
                  {selected.community}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#4A4A46]">Words</dt>
                <dd className="text-[#888480]">{selected.wordCount?.toLocaleString() ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#4A4A46]">Connections</dt>
                <dd className="text-[#888480]">{selectedNeighbors.length}</dd>
              </div>
            </dl>

            <Link
              href={`/app/vault?spin=${selected.id}`}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A2A] px-3 py-1.5 text-xs font-medium text-[#F0EDE8] transition-colors hover:border-[#4A4A46]"
            >
              Open in Vault <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>

            {selectedNeighbors.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4A4A46]">
                  Connected to
                </p>
                <ul className="space-y-1">
                  {selectedNeighbors.map((id) => {
                    const n = nodeById.get(id)
                    if (!n) return null
                    return (
                      <li key={id}>
                        <button
                          onClick={() => focusNode(id)}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-[#888480] transition-colors hover:bg-[#1E1E1E] hover:text-[#F0EDE8]"
                        >
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: n.color }} />
                          <span className="truncate">{n.label}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-sm text-[#888480]">Click a node to inspect it.</p>
            <p className="mt-1 text-xs text-[#4A4A46]">
              {graph.nodes.length} spins · {graph.links.length} connections
            </p>
          </div>
        )}
      </aside>
    </div>
  )
}
