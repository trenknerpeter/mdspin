// Pure layout math for the Vault Map's galaxy view. No React, no Supabase — the component
// (components/library/vault-galaxy.tsx) owns fetching and rendering, this file owns geometry,
// which is the part worth unit-testing.
//
// Everything here is DETERMINISTIC: a given project id always resolves to the same position.
// That's the whole design constraint — a galaxy that reshuffles on every refresh would make the
// view useless for orientation, which is its only job. So positions come from hashing the id
// rather than from Math.random() or a physics simulation with a random seed.

/** The SVG coordinate space every layout function works in. The component renders this through
 *  a viewBox, so it scales to whatever the container is — these are not pixels. */
export const GALAXY_WIDTH = 1000
export const GALAXY_HEIGHT = 620

export interface LayoutNode {
  id: string
  x: number
  y: number
  r: number
  /** Anchors this node during relaxation: others move out of its way, it never moves out of
   *  theirs. Used for the focused project and its moons (documents must scatter around them,
   *  not shove them aside) and for planets the user has dragged to a chosen spot. */
  fixed?: boolean
}

/** FNV-1a. Small, fast, and good enough spread for turning an id into a seed. */
export function hash32(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** mulberry32 — a tiny seeded PRNG. Same seed, same sequence, on every machine and every run. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A stable pseudo-random point in the unit square for this id. `seed` namespaces it, so the
 *  same document id can sit in one place among its siblings and a different place in the
 *  starfield without the two correlating. */
export function hashPosition(id: string, seed = "galaxy"): { x: number; y: number } {
  const rnd = mulberry32(hash32(`${seed}|${id}`))
  return { x: rnd(), y: rnd() }
}

/** Area-proportional sizing: a project with 4x the documents reads as ~2x the radius, which is
 *  how the eye actually compares circles. Clamped so a 1-document project is still visible and
 *  a 500-document one doesn't swallow the galaxy. */
export function radiusForCount(count: number, min = 16, scale = 7, max = 54): number {
  return Math.min(max, min + Math.sqrt(Math.max(0, count)) * scale)
}

function clamp(v: number, lo: number, hi: number): number {
  // lo > hi happens when a node is wider than its bounds; centring beats clamping to a negative
  // range, which would slam every oversized node into the same corner.
  if (lo > hi) return (lo + hi) / 2
  return Math.min(hi, Math.max(lo, v))
}

export interface RelaxOptions {
  width?: number
  height?: number
  /** Extra breathing room between two circles, on top of their radii — this is where the
   *  labels live, so it's generous. */
  padding?: number
  /** Keep-inside-bounds inset, likewise sized for the label that hangs below each node. */
  margin?: number
  iterations?: number
  /**
   * How much wider than tall each node's personal space is. Labels sit under a node and are far
   * wider than the dot itself, so two nodes side by side need much more room than two stacked
   * vertically. `aspect: 4` means a purely horizontal pair must be 4x further apart than a
   * purely vertical one before they count as clear.
   */
  aspect?: number
  /** Scenes can legitimately extend past the canvas (auto-fit zooms out to suit), so bounds
   *  clamping is opt-out. */
  clampToBounds?: boolean
}

/**
 * Push overlapping circles apart until they aren't overlapping (or we run out of iterations).
 *
 * Deliberately a fixed small number of passes rather than a simulation run to convergence:
 * it terminates in predictable time regardless of vault size, and the starting positions are
 * already well-spread by the hash, so this only has to fix local collisions rather than
 * discover a whole layout.
 */
export function relaxCollisions<T extends LayoutNode>(nodes: T[], opts: RelaxOptions = {}): T[] {
  const {
    width = GALAXY_WIDTH,
    height = GALAXY_HEIGHT,
    padding = 26,
    margin = 46,
    iterations = 60,
    aspect = 1,
    clampToBounds = true,
  } = opts
  const out = nodes.map((n) => ({ ...n }))

  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i]
        const b = out[j]
        if (a.fixed && b.fixed) continue
        let dx = b.x - a.x
        let dy = b.y - a.y
        // Measure in a horizontally-squashed space so `aspect` widens each node's personal
        // space without changing how the push itself is applied.
        let dist = Math.hypot(dx / aspect, dy)
        const minDist = a.r + b.r + padding
        if (dist >= minDist) continue
        // Exactly coincident (a pinned planet dropped straight onto another): pick a direction
        // rather than divide by zero. It points toward the canvas centre, because the node being
        // pushed needs somewhere to go — a fixed direction like +x deadlocks against bounds
        // clamping when the pair sits on an edge, pushing out and being clamped back forever.
        if (dist === 0) {
          const toCx = width / 2 - a.x
          const toCy = height / 2 - a.y
          const m = Math.hypot(toCx, toCy)
          if (m > 0.001) {
            dx = toCx / m
            dy = toCy / m
          } else {
            dx = 1
            dy = 0
          }
          dist = 1
        }
        const overlap = minDist - dist
        const ux = dx / dist
        const uy = dy / dist
        // A fixed node holds its ground and the other absorbs the whole correction.
        if (a.fixed) {
          b.x += ux * overlap
          b.y += uy * overlap
        } else if (b.fixed) {
          a.x -= ux * overlap
          a.y -= uy * overlap
        } else {
          const half = overlap / 2
          a.x -= ux * half
          a.y -= uy * half
          b.x += ux * half
          b.y += uy * half
        }
      }
    }
    if (!clampToBounds) continue
    for (const n of out) {
      if (n.fixed) continue
      n.x = clamp(n.x, n.r + margin, width - n.r - margin)
      n.y = clamp(n.y, n.r + margin, height - n.r - margin)
    }
  }
  return out
}

export interface GalaxyItem {
  id: string
  count: number
}

/**
 * Level 1: scatter every root project (plus the Unfiled bucket) across the canvas, sized by
 * document count, then separate any that landed on top of each other.
 */
export function layoutGalaxy(
  items: GalaxyItem[],
  opts: {
    width?: number
    height?: number
    seed?: string
    margin?: number
    /** Positions the user has dragged a planet to, by node id. A pinned planet is placed there
     *  exactly and marked fixed, so relaxation moves its neighbours instead of undoing the
     *  user's choice. */
    pinned?: Record<string, { x: number; y: number }>
  } = {}
): LayoutNode[] {
  const {
    width = GALAXY_WIDTH,
    height = GALAXY_HEIGHT,
    seed = "galaxy",
    margin = 60,
    pinned,
  } = opts
  const seeded = items.map((item) => {
    const r = radiusForCount(item.count)
    const pin = pinned?.[item.id]
    if (pin) return { id: item.id, r, x: pin.x, y: pin.y, fixed: true }
    const p = hashPosition(item.id, seed)
    return {
      id: item.id,
      r,
      x: margin + p.x * Math.max(0, width - 2 * margin),
      y: margin + p.y * Math.max(0, height - 2 * margin),
    }
  })
  return relaxCollisions(seeded, { width, height, margin })
}

/**
 * Subprojects as moons: evenly spaced on an ellipse around their parent. Evenly spaced rather
 * than hashed because there are few of them and regular spacing reads as an orbit — the one
 * place in this view where order beats organic scatter.
 */
export function layoutRing(
  items: GalaxyItem[],
  opts: { cx: number; cy: number; radius: number; scaleX?: number }
): LayoutNode[] {
  const { cx, cy, radius, scaleX = 1 } = opts
  return items.map((item, i) => {
    const angle = (i / Math.max(items.length, 1)) * Math.PI * 2 - Math.PI / 2
    return {
      id: item.id,
      x: cx + Math.cos(angle) * radius * scaleX,
      y: cy + Math.sin(angle) * radius,
      r: radiusForCount(item.count, 11, 4, 26),
    }
  })
}

/**
 * Documents as stars, scattered organically through an elliptical annulus around their project.
 *
 * `sqrt` on the radial draw makes the scatter uniform by AREA — without it everything bunches
 * against the inner edge, because a thin ring near the centre has far less room than one further
 * out. The result is deliberately irregular; callers that also draw labels should follow this
 * with `relaxCollisions({ aspect })` to stop those labels colliding, which keeps the organic
 * look while making it readable.
 */
export function layoutScatter(
  ids: string[],
  opts: {
    cx: number
    cy: number
    inner: number
    outer: number
    r?: number
    scaleX?: number
    seed?: string
  }
): LayoutNode[] {
  const { cx, cy, inner, outer, r = 7, scaleX = 1, seed = "docs" } = opts
  return ids.map((id) => {
    const rnd = mulberry32(hash32(`${seed}|${id}`))
    const angle = rnd() * Math.PI * 2
    const dist = inner + Math.sqrt(rnd()) * Math.max(0, outer - inner)
    return {
      id,
      x: cx + Math.cos(angle) * dist * scaleX,
      y: cy + Math.sin(angle) * dist,
      r,
    }
  })
}

/**
 * Documents as stars, on concentric rings rather than a random scatter.
 *
 * Even angular spacing is what makes the titles readable: a random scatter clumps, and two
 * clumped dots put their labels on top of each other. `minSpacing` is set from the widest
 * label we're willing to draw, so a ring only takes as many documents as it can label cleanly,
 * and the rest spill outward to the next ring. A small deterministic angular jitter keeps it
 * from looking like a clock face.
 */
export function layoutRings(
  ids: string[],
  opts: {
    cx: number
    cy: number
    inner: number
    ringGap: number
    minSpacing: number
    scaleX?: number
    r?: number
    seed?: string
  }
): LayoutNode[] {
  const { cx, cy, inner, ringGap, minSpacing, scaleX = 1, r = 7, seed = "docs" } = opts
  const out: LayoutNode[] = []
  let i = 0
  let ring = 0
  while (i < ids.length) {
    const radius = inner + ring * ringGap
    // The ellipse's circumference is bigger than a circle of `radius` when scaleX > 1; the mean
    // of the two axes is a good enough approximation for deciding how many fit.
    const meanRadius = (radius * (1 + scaleX)) / 2
    const capacity = Math.max(1, Math.floor((2 * Math.PI * meanRadius) / minSpacing))
    const take = Math.min(capacity, ids.length - i)
    for (let k = 0; k < take; k++) {
      const id = ids[i + k]
      const rnd = mulberry32(hash32(`${seed}|${id}`))
      const jitter = (rnd() - 0.5) * 0.1
      // Alternate rings are offset by half a slot so documents don't line up radially.
      const angle = ((k + (ring % 2) * 0.5) / take) * Math.PI * 2 - Math.PI / 2 + jitter
      out.push({
        id,
        x: cx + Math.cos(angle) * radius * scaleX,
        y: cy + Math.sin(angle) * radius,
        r,
      })
    }
    i += take
    ring++
  }
  return out
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function boundsOf(nodes: LayoutNode[], pad = 0): Bounds {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: GALAXY_WIDTH, maxY: GALAXY_HEIGHT }
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of nodes) {
    minX = Math.min(minX, n.x - n.r)
    minY = Math.min(minY, n.y - n.r)
    maxX = Math.max(maxX, n.x + n.r)
    maxY = Math.max(maxY, n.y + n.r)
  }
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad }
}

export interface ViewTransform {
  scale: number
  tx: number
  ty: number
}

/**
 * The pan/zoom transform that fits `bounds` into the viewport, centred. Capped at `maxScale`
 * so a nearly-empty scene doesn't blow one planet up to fill the screen — it should sit at
 * natural size with space around it.
 *
 * Maps a canvas point p to `p * scale + t`, matching `translate(tx, ty) scale(scale)`.
 */
export function computeFitView(
  bounds: Bounds,
  width = GALAXY_WIDTH,
  height = GALAXY_HEIGHT,
  maxScale = 1
): ViewTransform {
  const bw = Math.max(1, bounds.maxX - bounds.minX)
  const bh = Math.max(1, bounds.maxY - bounds.minY)
  const scale = Math.min(maxScale, width / bw, height / bh)
  const cx = (bounds.minX + bounds.maxX) / 2
  const cy = (bounds.minY + bounds.maxY) / 2
  return { scale, tx: width / 2 - cx * scale, ty: height / 2 - cy * scale }
}

/** Zoom by `factor` while keeping the canvas point under (`atX`, `atY`) pinned in place —
 *  the "zoom where the cursor is" behaviour every map has. */
export function zoomAround(
  view: ViewTransform,
  atX: number,
  atY: number,
  factor: number,
  minScale = 0.4,
  maxScale = 8
): ViewTransform {
  const next = Math.min(maxScale, Math.max(minScale, view.scale * factor))
  const k = next / view.scale
  return {
    scale: next,
    tx: atX - (atX - view.tx) * k,
    ty: atY - (atY - view.ty) * k,
  }
}

export interface Star {
  x: number
  y: number
  r: number
  o: number
}

/** Background atmosphere. Pure decoration — these dots carry no data, which is exactly why
 *  they're generated from a fixed seed rather than from anything in the vault. */
export function generateStarfield(
  count: number,
  width = GALAXY_WIDTH,
  height = GALAXY_HEIGHT,
  seed = "stars"
): Star[] {
  const rnd = mulberry32(hash32(seed))
  const stars: Star[] = []
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rnd() * width,
      y: rnd() * height,
      r: 0.3 + rnd() * 0.9,
      o: 0.12 + rnd() * 0.4,
    })
  }
  return stars
}
