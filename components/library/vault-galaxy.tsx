"use client"

// The Vault Map: a purely visual layer over the structure that already exists. Vault = galaxy,
// root projects = planets, subprojects = moons, documents = stars. Nothing here analyses,
// ranks, or infers anything — see docs/superpowers/specs/2026-09-13-map-galaxy-view-design.md
// for why the previous two versions of this page (a relatedness force-graph, then an
// LLM-adjudicated connections lens) were both removed.
//
// Three interaction layers that compose:
//   DRILL-DOWN  moves between levels (click a planet; Esc or the breadcrumb to come back)
//   CAMERA      pans and zooms freely within whichever level you're on
//   ARRANGE     drags a planet to a chosen spot, saved per user
// Opening a document does NOT leave the Map — it opens the same detail panel the rest of the
// Vault uses, over the galaxy.
//
// All geometry lives in lib/vault/galaxy-layout.ts so it can be unit-tested; this file owns
// fetching, interaction, and rendering.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronRight, FileText, Maximize2, Minus, Plus, Search, X } from "lucide-react"
import { SpinDetailPanel } from "@/components/library/spin-detail-panel"
import {
  childrenOf,
  deleteSpin,
  getSpin,
  listProjects,
  listSpins,
  listSpinStats,
  removeFromVault,
  rollUpProjectCounts,
  rootProjects,
  updateSpin,
  UNFILED,
  type Project,
  type Spin,
  type SpinStats,
  type UpdateSpinFields,
} from "@/lib/library"
import { listMapPositions, saveMapPosition, type MapPosition } from "@/lib/vault/map-positions"
import {
  boundsOf,
  computeFitView,
  GALAXY_HEIGHT,
  GALAXY_WIDTH,
  generateStarfield,
  hashPosition,
  layoutGalaxy,
  layoutRing,
  layoutScatter,
  relaxCollisions,
  zoomAround,
  type LayoutNode,
  type ViewTransform,
} from "@/lib/vault/galaxy-layout"

const CX = GALAXY_WIDTH / 2
const CY = GALAXY_HEIGHT / 2
const CENTER_R = 46
const MOON_ORBIT = 150
const DOC_INNER = 205
const DOC_OUTER = 335
const DOC_R = 7
const DOC_LABEL_CHARS = 20
/** Documents are scattered organically, then relaxed apart. `aspect` makes that separation much
 *  wider than it is tall, because a document's label is ~110 units wide and only ~12 tall —
 *  without it, two side-by-side stars have clear dots and completely overlapping titles. */
const DOC_ASPECT = 3.4
const DOC_PADDING = 26
/** Orbits and scatter are stretched horizontally: the canvas is much wider than it is tall, and
 *  a circular scene would waste both sides. Reads as an orbit seen at an angle. */
const SCENE_SCALE_X = 1.5
const NEUTRAL = "#4A4A46"
const MAX_LEVEL_DOCS = 500
const GALAXY_STARS = 150
const SCENE_STARS = 70
const MOON_PREVIEW_DOCS = 6

const MIN_SCALE = 0.4
const MAX_SCALE = 8
/** Above this many documents labels hide until you zoom in — past it they'd collide no matter
 *  how they're spaced, and the whole point of the labels is legibility. */
const LABEL_BUDGET = 40
const LABEL_ZOOM = 1.4
const DRAG_THRESHOLD = 3

const IDENTITY: ViewTransform = { scale: 1, tx: 0, ty: 0 }
const CENTER_OBSTACLE = "__center__"

function labelFor(spin: Spin): string {
  return spin.title || spin.filename
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

/** Screen coordinates → the SVG's own viewBox units. Uses the browser's own matrix so it stays
 *  correct regardless of how the viewBox is letterboxed into the container. */
function clientToCanvas(svg: SVGSVGElement, clientX: number, clientY: number) {
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: 0, y: 0 }
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const p = pt.matrixTransform(ctm.inverse())
  return { x: p.x, y: p.y }
}

/** …and on into the pan/zoom group's own space, which is where layout coordinates live. */
function clientToScene(svg: SVGSVGElement, clientX: number, clientY: number, v: ViewTransform) {
  const p = clientToCanvas(svg, clientX, clientY)
  return { x: (p.x - v.tx) / v.scale, y: (p.y - v.ty) / v.scale }
}

export function VaultGalaxy() {
  const [projects, setProjects] = useState<Project[]>([])
  const [stats, setStats] = useState<SpinStats | null>(null)
  const [pinned, setPinned] = useState<Record<string, MapPosition>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /** [] = galaxy, [rootId] = a project (or UNFILED), [rootId, subId] = a subproject. */
  const [path, setPath] = useState<string[]>([])
  const [docs, setDocs] = useState<Spin[]>([])
  const [docsLoading, setDocsLoading] = useState(false)

  const [query, setQuery] = useState("")
  const [docResults, setDocResults] = useState<Spin[]>([])
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [openDoc, setOpenDoc] = useState<Spin | null>(null)

  const [view, setView] = useState<ViewTransform>(IDENTITY)
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const panRef = useRef<{ x: number; y: number } | null>(null)
  const movedRef = useRef(false)

  /** The planet currently being dragged, following the cursor until released. */
  const [dragging, setDragging] = useState<{ id: string; x: number; y: number } | null>(null)
  const draggingRef = useRef<{ id: string; x: number; y: number } | null>(null)

  const [hoveredMoon, setHoveredMoon] = useState<string | null>(null)
  const [moonDocs, setMoonDocs] = useState<Record<string, Spin[]>>({})

  const reloadStats = useCallback(async () => {
    const [p, s] = await Promise.all([listProjects(), listSpinStats()])
    setProjects(p)
    setStats(s)
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([reloadStats(), listMapPositions().catch(() => ({}))])
      .then(([, positions]) => {
        if (!cancelled) setPinned(positions as Record<string, MapPosition>)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load your Vault.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadStats])

  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])
  const roots = useMemo(() => rootProjects(projects), [projects])
  const rolled = useMemo(
    () => (stats ? rollUpProjectCounts(stats.byProject, projects) : {}),
    [stats, projects]
  )

  const rootId = path[0] ?? null
  const subId = path[1] ?? null
  const focusId = subId ?? rootId

  const loadLevelDocs = useCallback(async (id: string | null) => {
    if (!id) {
      setDocs([])
      return
    }
    setDocsLoading(true)
    try {
      // descendantIds: [] means "this folder's own documents, not its subprojects'", which is
      // what keeps a project's own stars distinct from its moons' stars.
      const rows = await listSpins({
        projectId: id,
        descendantIds: [],
        from: 0,
        to: MAX_LEVEL_DOCS - 1,
        inVault: true,
      })
      setDocs(rows)
    } catch {
      setDocs([])
    } finally {
      setDocsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLevelDocs(focusId)
  }, [focusId, loadLevelDocs])

  // Debounced document search. Project names are matched locally (they're already in memory).
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setDocResults([])
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      listSpins({ query: q, from: 0, to: 5, inVault: true })
        .then((rows) => {
          if (!cancelled) setDocResults(rows)
        })
        .catch(() => {
          if (!cancelled) setDocResults([])
        })
    }, 220)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query])

  useEffect(() => {
    return () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current)
    }
  }, [])

  const flash = useCallback((id: string) => {
    setHighlightId(id)
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
    highlightTimer.current = setTimeout(() => setHighlightId(null), 5000)
  }, [])

  const enter = useCallback(
    (id: string) => {
      const p = byId.get(id)
      if (p?.parent_id) setPath([p.parent_id, p.id])
      else setPath([id])
      setHighlightId(null)
      setHoveredMoon(null)
    },
    [byId]
  )

  // Escape walks back up a level — but only when no document panel is open, since Escape
  // should close that first (the Sheet handles its own).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !openDoc && path.length > 0) {
        setPath((prev) => prev.slice(0, -1))
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [path.length, openDoc])

  const projectResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return projects.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 5)
  }, [query, projects])

  const nameFor = useCallback(
    (id: string) => (id === UNFILED ? "Unfiled" : byId.get(id)?.name ?? ""),
    [byId]
  )
  const colorFor = useCallback(
    (id: string) => (id === UNFILED ? NEUTRAL : byId.get(id)?.color ?? NEUTRAL),
    [byId]
  )
  const countFor = useCallback(
    (id: string) => (id === UNFILED ? stats?.unfiled ?? 0 : rolled[id] ?? 0),
    [rolled, stats]
  )

  // --- Opening a document, without leaving the Map -------------------------------------
  /** List rows carry markdown_text: null, so the panel opens on the row immediately (when we
   *  have one) and the full record swaps in when it arrives. `wantedIdRef` is the guard: a slow
   *  fetch must not overwrite a document the user has since switched to, and it can't compare
   *  against the currently-open doc, because opening a related document legitimately replaces
   *  a different one. */
  const wantedIdRef = useRef<string | null>(null)
  const openDocById = useCallback(async (id: string, row?: Spin) => {
    wantedIdRef.current = id
    if (row) setOpenDoc(row)
    const full = await getSpin(id).catch(() => null)
    if (full && wantedIdRef.current === id) setOpenDoc(full)
  }, [])

  const handleSave = useCallback(
    async (id: string, fields: UpdateSpinFields) => {
      const updated = await updateSpin(id, fields)
      setOpenDoc(updated)
      await Promise.all([reloadStats(), loadLevelDocs(focusId)])
    },
    [reloadStats, loadLevelDocs, focusId]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteSpin(id)
      setOpenDoc(null)
      await Promise.all([reloadStats(), loadLevelDocs(focusId)])
    },
    [reloadStats, loadLevelDocs, focusId]
  )

  const handleRemoveFromVault = useCallback(
    async (id: string) => {
      await removeFromVault(id)
      setOpenDoc(null)
      await Promise.all([reloadStats(), loadLevelDocs(focusId)])
    },
    [reloadStats, loadLevelDocs, focusId]
  )

  const jumpToDoc = useCallback(
    (spin: Spin) => {
      const pid = spin.project_ids[0] ?? null
      if (!pid) setPath([UNFILED])
      else {
        const p = byId.get(pid)
        if (p?.parent_id) setPath([p.parent_id, p.id])
        else setPath([pid])
      }
      flash(spin.id)
      setQuery("")
    },
    [byId, flash]
  )

  // --- Layouts -------------------------------------------------------------------------
  const galaxyItems = useMemo(() => {
    if (!stats) return []
    const items = roots.map((p) => ({ id: p.id, count: rolled[p.id] ?? 0 }))
    if (stats.unfiled > 0) items.push({ id: UNFILED, count: stats.unfiled })
    return items
  }, [roots, rolled, stats])

  // The planet under the cursor is pinned to it mid-drag, so it tracks the pointer exactly and
  // the others relax out of its way live.
  const effectivePins = useMemo(
    () => (dragging ? { ...pinned, [dragging.id]: { x: dragging.x, y: dragging.y } } : pinned),
    [pinned, dragging]
  )
  const planets = useMemo(
    () => layoutGalaxy(galaxyItems, { pinned: effectivePins }),
    [galaxyItems, effectivePins]
  )

  const galaxyStars = useMemo(() => generateStarfield(GALAXY_STARS), [])
  const sceneStars = useMemo(
    () => generateStarfield(SCENE_STARS, GALAXY_WIDTH, GALAXY_HEIGHT, "scene"),
    []
  )

  const moons = useMemo(() => {
    if (!rootId || subId || rootId === UNFILED) return []
    const kids = childrenOf(rootId, projects)
    return layoutRing(
      kids.map((k) => ({ id: k.id, count: stats?.byProject[k.id] ?? 0 })),
      { cx: CX, cy: CY, radius: MOON_ORBIT, scaleX: SCENE_SCALE_X }
    )
  }, [rootId, subId, projects, stats])

  // Documents scatter organically, then get pushed apart just enough that their labels don't
  // collide — the centre planet and the moons act as immovable obstacles they flow around.
  const docNodes = useMemo(() => {
    if (!focusId || docs.length === 0) return []
    const scattered = layoutScatter(
      docs.map((d) => d.id),
      {
        cx: CX,
        cy: CY,
        inner: DOC_INNER,
        outer: DOC_OUTER,
        r: DOC_R,
        scaleX: SCENE_SCALE_X,
        seed: focusId,
      }
    )
    const obstacles: LayoutNode[] = [
      { id: CENTER_OBSTACLE, x: CX, y: CY, r: CENTER_R + 18, fixed: true },
      ...moons.map((m) => ({ ...m, r: m.r + 16, fixed: true })),
    ]
    const obstacleIds = new Set(obstacles.map((o) => o.id))
    return relaxCollisions([...obstacles, ...scattered], {
      padding: DOC_PADDING,
      aspect: DOC_ASPECT,
      iterations: 40,
      clampToBounds: false,
    }).filter((n) => !obstacleIds.has(n.id))
  }, [docs, focusId, moons])

  const docById = useMemo(() => new Map(docs.map((d) => [d.id, d])), [docs])

  // Fit whatever the current level contains into the frame.
  const levelKey = path.join("/")
  const fitCurrentLevel = useCallback(() => {
    if (path.length === 0) {
      setView(planets.length ? computeFitView(boundsOf(planets, 70)) : IDENTITY)
      return
    }
    setView(
      computeFitView(
        boundsOf([{ id: CENTER_OBSTACLE, x: CX, y: CY, r: CENTER_R + 30 }, ...moons, ...docNodes], 60)
      )
    )
  }, [path.length, planets, moons, docNodes])

  // Only on a level change or when its contents finish loading — never on pan/zoom, whose state
  // changes don't touch these memoised layouts, so the camera stays put. Dragging a planet is
  // excluded too: `planets` changes on every pointermove, and refitting mid-drag would make the
  // canvas lurch under the cursor.
  const draggingId = dragging?.id ?? null
  useEffect(() => {
    if (draggingId) return
    fitCurrentLevel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelKey, docNodes, moons])

  // --- Camera --------------------------------------------------------------------------
  const zoomBy = useCallback((factor: number) => {
    setView((v) => zoomAround(v, CX, CY, factor, MIN_SCALE, MAX_SCALE))
  }, [])

  // Wheel has to be bound manually: React attaches wheel listeners passively, so
  // preventDefault() inside onWheel is ignored and the page scrolls behind the map. The deps
  // matter — the loading/error/empty branches return before the <svg> exists, so a []-deps
  // effect would bind to nothing and never retry.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const ctm = svg.getScreenCTM()
      const pxPerUnit = ctm?.a || 1
      // A pinch on a trackpad arrives as ctrl+wheel; cmd/ctrl+wheel is the same intent.
      const pinch = e.ctrlKey || e.metaKey
      // A mouse wheel sends chunky, whole-number, purely-vertical deltas; a trackpad's
      // two-finger scroll is fine-grained and usually carries horizontal drift. Not perfect,
      // but it's the only signal the platform gives, and both gestures stay available
      // regardless via the zoom buttons and drag-to-pan.
      const mouseWheel = e.deltaX === 0 && Math.abs(e.deltaY) >= 40 && Number.isInteger(e.deltaY)
      if (pinch || mouseWheel) {
        const p = clientToCanvas(svg, e.clientX, e.clientY)
        setView((v) => zoomAround(v, p.x, p.y, Math.exp(-e.deltaY * 0.002), MIN_SCALE, MAX_SCALE))
      } else {
        setView((v) => ({
          ...v,
          tx: v.tx - e.deltaX / pxPerUnit,
          ty: v.ty - e.deltaY / pxPerUnit,
        }))
      }
    }
    svg.addEventListener("wheel", onWheel, { passive: false })
    return () => svg.removeEventListener("wheel", onWheel)
  }, [loading, error, galaxyItems.length])

  // --- Pointer: pan the canvas, or drag a planet ---------------------------------------
  const startPlanetDrag = (e: React.PointerEvent, node: LayoutNode) => {
    // Stop the canvas from panning at the same time.
    e.stopPropagation()
    movedRef.current = false
    const next = { id: node.id, x: node.x, y: node.y }
    draggingRef.current = next
    setDragging(next)
  }

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    panRef.current = { x: e.clientX, y: e.clientY }
    movedRef.current = false
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return

    const drag = draggingRef.current
    if (drag) {
      const p = clientToScene(svg, e.clientX, e.clientY, view)
      if (Math.hypot(p.x - drag.x, p.y - drag.y) > DRAG_THRESHOLD) movedRef.current = true
      const next = { id: drag.id, x: p.x, y: p.y }
      draggingRef.current = next
      setDragging(next)
      return
    }

    const pan = panRef.current
    if (!pan) return
    const dx = e.clientX - pan.x
    const dy = e.clientY - pan.y
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) movedRef.current = true
    const s = svg.getScreenCTM()?.a || 1
    setView((v) => ({ ...v, tx: v.tx + dx / s, ty: v.ty + dy / s }))
    panRef.current = { x: e.clientX, y: e.clientY }
  }

  const endPointer = () => {
    const drag = draggingRef.current
    if (drag && movedRef.current) {
      const pos = { x: drag.x, y: drag.y }
      setPinned((prev) => ({ ...prev, [drag.id]: pos }))
      // Fire-and-forget: the position is already applied locally, and a failed write should not
      // yank the planet back out from under the user mid-session.
      saveMapPosition(drag.id, pos).catch(() => {})
    }
    draggingRef.current = null
    setDragging(null)
    panRef.current = null
  }

  /** A drag that ends over a planet must not also count as a click on it. */
  const clickGuard = (fn: () => void) => () => {
    if (movedRef.current) return
    fn()
  }

  // --- Moon hover preview ---------------------------------------------------------------
  const hoverMoon = useCallback(
    (id: string) => {
      setHoveredMoon(id)
      if (moonDocs[id]) return
      listSpins({ projectId: id, descendantIds: [], from: 0, to: 19, inVault: true })
        .then((rows) => setMoonDocs((prev) => ({ ...prev, [id]: rows })))
        .catch(() => setMoonDocs((prev) => ({ ...prev, [id]: [] })))
    },
    [moonDocs]
  )

  /** Where to park the hover card, in container pixels. Goes through the browser's matrix
   *  rather than assuming the viewBox maps linearly onto the container, which it doesn't once
   *  preserveAspectRatio letterboxes it. */
  const hoverPos = useMemo(() => {
    if (!hoveredMoon) return null
    const moon = moons.find((m) => m.id === hoveredMoon)
    const svg = svgRef.current
    const wrap = wrapRef.current
    if (!moon || !svg || !wrap) return null
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const pt = svg.createSVGPoint()
    pt.x = moon.x * view.scale + view.tx
    pt.y = (moon.y - moon.r) * view.scale + view.ty
    const scr = pt.matrixTransform(ctm)
    const rect = wrap.getBoundingClientRect()
    return { left: scr.x - rect.left, top: scr.y - rect.top }
  }, [hoveredMoon, moons, view])

  // --- Render helpers ------------------------------------------------------------------
  const glowDefs = (nodes: LayoutNode[]) => (
    <defs>
      {nodes.map((n) => {
        const c = colorFor(n.id)
        return (
          <radialGradient key={n.id} id={`glow-${n.id}`}>
            <stop offset="0%" stopColor={c} stopOpacity="0.5" />
            <stop offset="100%" stopColor={c} stopOpacity="0" />
          </radialGradient>
        )
      })}
    </defs>
  )

  const starfield = (stars: ReturnType<typeof generateStarfield>) =>
    stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#F0EDE8" opacity={s.o} />)

  // `outline-none` everywhere an SVG <g> is focusable: the browser's default focus outline draws
  // a hard white rectangle around the group's bounding box, which on a circular planet looks
  // like a bug. The keyboard affordance is preserved as a ring on the shape itself, via the
  // group-focus-visible variant on each node's hover ring.
  const interactiveG = "group cursor-pointer outline-none [&:focus]:outline-none"

  const renderPlanet = (n: LayoutNode) => {
    const isUnfiled = n.id === UNFILED
    const name = nameFor(n.id)
    const count = countFor(n.id)
    const color = colorFor(n.id)
    const isDragging = dragging?.id === n.id
    return (
      <g
        key={n.id}
        className={interactiveG}
        role="button"
        tabIndex={0}
        aria-label={`${name}, ${count} document${count === 1 ? "" : "s"}`}
        onPointerDown={(e) => startPlanetDrag(e, n)}
        onClick={clickGuard(() => enter(n.id))}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            enter(n.id)
          }
        }}
      >
        {!isUnfiled && <circle cx={n.x} cy={n.y} r={n.r * 2.6} fill={`url(#glow-${n.id})`} />}
        {isUnfiled ? (
          <>
            <circle cx={n.x} cy={n.y} r={n.r} fill="transparent" />
            {Array.from({ length: Math.min(count, 7) }, (_, i) => {
              const p = hashPosition(`${UNFILED}-${i}`, "asteroid")
              return (
                <circle
                  key={i}
                  cx={n.x + (p.x - 0.5) * n.r * 1.8}
                  cy={n.y + (p.y - 0.5) * n.r * 1.8}
                  r={3.5}
                  fill={NEUTRAL}
                />
              )
            })}
          </>
        ) : (
          <circle cx={n.x} cy={n.y} r={n.r} fill={color} />
        )}
        <circle
          cx={n.x}
          cy={n.y}
          r={n.r + 7}
          fill="none"
          stroke={isUnfiled ? "#888480" : color}
          strokeWidth={isDragging ? 1.5 : 1}
          className={
            isDragging
              ? "opacity-90"
              : "opacity-0 transition-opacity group-hover:opacity-70 group-focus-visible:opacity-70"
          }
        />
        <text x={n.x} y={n.y + n.r + 20} textAnchor="middle" fontSize={13} fill="#F0EDE8">
          {name}
        </text>
        <text x={n.x} y={n.y + n.r + 34} textAnchor="middle" fontSize={10} fill="#888480">
          {count} document{count === 1 ? "" : "s"}
        </text>
      </g>
    )
  }

  const showDocLabels = docs.length <= LABEL_BUDGET || view.scale >= LABEL_ZOOM

  const renderDoc = (n: LayoutNode) => {
    const spin = docById.get(n.id)
    if (!spin) return null
    const isHot = highlightId === n.id
    const full = labelFor(spin)
    return (
      <g
        key={n.id}
        className={interactiveG}
        role="button"
        tabIndex={0}
        aria-label={`Open ${full}`}
        onClick={clickGuard(() => openDocById(spin.id, spin))}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            openDocById(spin.id, spin)
          }
        }}
      >
        {/* Native tooltip earns its place here: the drawn label is truncated, this isn't. */}
        <title>{full}</title>
        <circle cx={n.x} cy={n.y} r={n.r + 8} fill="transparent" />
        <circle
          cx={n.x}
          cy={n.y}
          r={isHot ? n.r + 2 : n.r}
          fill="#F0EDE8"
          opacity={isHot ? 1 : 0.82}
          className="transition-all group-hover:opacity-100"
        />
        {isHot && (
          <circle cx={n.x} cy={n.y} r={n.r + 8} fill="none" stroke="#FF4800" strokeWidth={1.4} />
        )}
        <circle
          cx={n.x}
          cy={n.y}
          r={n.r + 6}
          fill="none"
          stroke="#F0EDE8"
          strokeWidth={0.8}
          className="opacity-0 transition-opacity group-hover:opacity-50 group-focus-visible:opacity-70"
        />
        {showDocLabels && (
          <text
            x={n.x}
            y={n.y + n.r + 15}
            textAnchor="middle"
            fontSize={10}
            fill={isHot ? "#F0EDE8" : "#888480"}
            className="transition-colors group-hover:fill-[#F0EDE8]"
          >
            {truncate(full, DOC_LABEL_CHARS)}
          </text>
        )}
      </g>
    )
  }

  // --- States --------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <svg className="h-6 w-6 animate-spin text-[#FF4800]" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[#FF4800]/30 bg-[#161616] p-12 text-center">
        <p className="text-sm text-[#FF4800]">{error}</p>
      </div>
    )
  }

  if (galaxyItems.length === 0) {
    return (
      <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-12 text-center">
        <FileText className="mx-auto mb-3 h-8 w-8 text-[#4A4A46]" />
        <p className="text-sm text-[#888480]">Your Vault is empty.</p>
        <p className="mt-1 text-sm text-[#888480]">Add some documents and they&apos;ll show up here.</p>
      </div>
    )
  }

  const focusName = focusId ? nameFor(focusId) : ""
  const focusColor = focusId ? colorFor(focusId) : NEUTRAL
  const sceneEmpty = !!focusId && !docsLoading && docs.length === 0 && moons.length === 0
  const ctrlBtn =
    "flex h-7 w-7 items-center justify-center rounded-md border border-[#2A2A2A] bg-[#161616]/90 text-[#888480] backdrop-blur transition-colors hover:border-[#4A4A46] hover:text-[#F0EDE8]"
  const hoveredMoonDocs = hoveredMoon ? moonDocs[hoveredMoon] : undefined

  return (
    <div>
      <style>{`
        @keyframes moonCardIn { from { opacity: 0; transform: translate(-50%, -100%) scale(0.96) } to { opacity: 1; transform: translate(-50%, -100%) scale(1) } }
        .moon-card { animation: moonCardIn 130ms ease-out }
      `}</style>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => setPath([])}
            className={
              path.length === 0
                ? "text-[#F0EDE8]"
                : "text-[#888480] transition-colors hover:text-[#F0EDE8]"
            }
          >
            Galaxy
          </button>
          {rootId && (
            <>
              <ChevronRight className="h-3 w-3 text-[#4A4A46]" />
              <button
                type="button"
                onClick={() => setPath([rootId])}
                className={
                  path.length === 1
                    ? "text-[#F0EDE8]"
                    : "text-[#888480] transition-colors hover:text-[#F0EDE8]"
                }
              >
                {nameFor(rootId)}
              </button>
            </>
          )}
          {subId && (
            <>
              <ChevronRight className="h-3 w-3 text-[#4A4A46]" />
              <span className="text-[#F0EDE8]">{nameFor(subId)}</span>
            </>
          )}
        </div>

        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#4A4A46]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a project or document…"
            className="w-full rounded-lg border border-[#2A2A2A] bg-[#161616] py-1.5 pl-8 pr-7 text-xs text-[#F0EDE8] placeholder:text-[#4A4A46] focus:border-[#4A4A46] focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#4A4A46] transition-colors hover:text-[#F0EDE8]"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {(projectResults.length > 0 || docResults.length > 0) && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-[#2A2A2A] bg-[#161616] shadow-[0_18px_44px_-12px_rgba(0,0,0,0.85)]">
              {projectResults.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      enter(p.id)
                      setQuery("")
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-[#F0EDE8] transition-colors hover:bg-[#1E1E1E]"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-sm"
                      style={{
                        background:
                          (p.parent_id ? byId.get(p.parent_id)?.color : p.color) ?? NEUTRAL,
                      }}
                    />
                    <span className="truncate">{p.name}</span>
                  </button>
                </li>
              ))}
              {docResults.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => jumpToDoc(d)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-[#888480] transition-colors hover:bg-[#1E1E1E] hover:text-[#F0EDE8]"
                  >
                    <FileText className="h-3 w-3 shrink-0 text-[#4A4A46]" />
                    <span className="truncate">{labelFor(d)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div
        ref={wrapRef}
        className="relative h-[70vh] overflow-hidden rounded-xl border border-[#2A2A2A] bg-[#0A0A0C]"
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${GALAXY_WIDTH} ${GALAXY_HEIGHT}`}
          className="h-full w-full touch-none select-none"
          style={{ cursor: dragging ? "grabbing" : "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerLeave={endPointer}
          onPointerCancel={endPointer}
        >
          <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
            {path.length === 0 ? (
              <g key="galaxy">
                {glowDefs(planets)}
                {starfield(galaxyStars)}
                {planets.map(renderPlanet)}
              </g>
            ) : (
              <g key={levelKey}>
                <defs>
                  <radialGradient id="glow-focus">
                    <stop offset="0%" stopColor={focusColor} stopOpacity="0.5" />
                    <stop offset="100%" stopColor={focusColor} stopOpacity="0" />
                  </radialGradient>
                </defs>
                {glowDefs(moons)}
                {starfield(sceneStars)}

                {moons.length > 0 && (
                  <ellipse
                    cx={CX}
                    cy={CY}
                    rx={MOON_ORBIT * SCENE_SCALE_X}
                    ry={MOON_ORBIT}
                    fill="none"
                    stroke="#2A2A2A"
                    strokeWidth={1}
                    strokeDasharray="2 5"
                  />
                )}

                <circle cx={CX} cy={CY} r={CENTER_R * 2.6} fill="url(#glow-focus)" />
                <circle cx={CX} cy={CY} r={CENTER_R} fill={focusColor} />
                <text x={CX} y={CY + CENTER_R + 22} textAnchor="middle" fontSize={15} fill="#F0EDE8">
                  {focusName}
                </text>
                {sceneEmpty && (
                  <text x={CX} y={CY + CENTER_R + 40} textAnchor="middle" fontSize={11} fill="#888480">
                    Nothing in here yet
                  </text>
                )}

                {moons.map((m) => {
                  const name = nameFor(m.id)
                  const count = stats?.byProject[m.id] ?? 0
                  const isHovered = hoveredMoon === m.id
                  return (
                    <g
                      key={m.id}
                      className={interactiveG}
                      role="button"
                      tabIndex={0}
                      aria-label={`${name}, ${count} document${count === 1 ? "" : "s"}`}
                      onPointerEnter={() => hoverMoon(m.id)}
                      onPointerLeave={() => setHoveredMoon(null)}
                      onFocus={() => hoverMoon(m.id)}
                      onBlur={() => setHoveredMoon(null)}
                      onClick={clickGuard(() => setPath([rootId!, m.id]))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          setPath([rootId!, m.id])
                        }
                      }}
                    >
                      <circle cx={m.x} cy={m.y} r={m.r * 2.4} fill={`url(#glow-${m.id})`} />
                      <circle
                        cx={m.x}
                        cy={m.y}
                        r={isHovered ? m.r + 2 : m.r}
                        fill={colorFor(rootId!)}
                        opacity={isHovered ? 0.95 : 0.65}
                        className="transition-all"
                      />
                      <circle
                        cx={m.x}
                        cy={m.y}
                        r={m.r + 6}
                        fill="none"
                        stroke={colorFor(rootId!)}
                        strokeWidth={1}
                        className="opacity-0 transition-opacity group-hover:opacity-70 group-focus-visible:opacity-70"
                      />
                      <text x={m.x} y={m.y + m.r + 16} textAnchor="middle" fontSize={11} fill="#C9C5BE">
                        {name}
                      </text>
                    </g>
                  )
                })}

                {docNodes.map(renderDoc)}
              </g>
            )}
          </g>
        </svg>

        {hoveredMoon && hoverPos && (
          <div
            className="moon-card pointer-events-none absolute z-10 w-56 -translate-x-1/2 -translate-y-full rounded-lg border border-[#2A2A2A] bg-[#161616] p-3 shadow-[0_18px_44px_-12px_rgba(0,0,0,0.85)]"
            style={{ left: hoverPos.left, top: hoverPos.top - 10 }}
          >
            <p className="mb-0.5 truncate text-xs font-semibold text-[#F0EDE8]">
              {nameFor(hoveredMoon)}
            </p>
            <p className="mb-2 text-[10px] uppercase tracking-wide text-[#4A4A46]">
              {stats?.byProject[hoveredMoon] ?? 0} document
              {(stats?.byProject[hoveredMoon] ?? 0) === 1 ? "" : "s"}
            </p>
            {hoveredMoonDocs === undefined ? (
              <p className="text-[11px] text-[#4A4A46]">Loading…</p>
            ) : hoveredMoonDocs.length === 0 ? (
              <p className="text-[11px] text-[#4A4A46]">Nothing in here yet.</p>
            ) : (
              <ul className="space-y-1">
                {hoveredMoonDocs.slice(0, MOON_PREVIEW_DOCS).map((d) => (
                  <li key={d.id} className="flex items-center gap-1.5 text-[11px] text-[#888480]">
                    <FileText className="h-2.5 w-2.5 shrink-0 text-[#4A4A46]" />
                    <span className="truncate">{labelFor(d)}</span>
                  </li>
                ))}
                {hoveredMoonDocs.length > MOON_PREVIEW_DOCS && (
                  <li className="pl-4 text-[11px] text-[#4A4A46]">
                    +{hoveredMoonDocs.length - MOON_PREVIEW_DOCS} more
                  </li>
                )}
              </ul>
            )}
          </div>
        )}

        <div className="absolute right-3 top-3 flex flex-col gap-1.5">
          <button type="button" onClick={() => zoomBy(1.3)} className={ctrlBtn} aria-label="Zoom in">
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => zoomBy(1 / 1.3)} className={ctrlBtn} aria-label="Zoom out">
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={fitCurrentLevel} className={ctrlBtn} aria-label="Fit to view">
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <p className="pointer-events-none absolute bottom-3 left-4 text-[11px] text-[#4A4A46]">
          {path.length === 0
            ? "Click a planet to look inside · drag a planet to move it · drag the background to pan"
            : docsLoading
              ? "Loading documents…"
              : `${docs.length} document${docs.length === 1 ? "" : "s"} here${moons.length ? ` · ${moons.length} subproject${moons.length === 1 ? "" : "s"}` : ""} · Esc to go back`}
        </p>
      </div>

      <SpinDetailPanel
        spin={openDoc}
        projects={projects}
        onClose={() => setOpenDoc(null)}
        onSave={handleSave}
        onDelete={handleDelete}
        onRemoveFromVault={handleRemoveFromVault}
        onOpen={(id) => openDocById(id, docById.get(id))}
      />
    </div>
  )
}
