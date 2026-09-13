import { describe, it, expect } from "vitest"
import {
  hash32,
  mulberry32,
  hashPosition,
  radiusForCount,
  relaxCollisions,
  layoutGalaxy,
  layoutRing,
  layoutRings,
  layoutScatter,
  boundsOf,
  computeFitView,
  zoomAround,
  generateStarfield,
  GALAXY_WIDTH,
  GALAXY_HEIGHT,
  type LayoutNode,
} from "@/lib/vault/galaxy-layout"

describe("hash32 / mulberry32", () => {
  it("is stable for the same string", () => {
    expect(hash32("plato-pm")).toBe(hash32("plato-pm"))
  })

  it("differs for different strings", () => {
    expect(hash32("plato-pm")).not.toBe(hash32("plato-pn"))
  })

  it("produces a repeatable sequence in [0,1)", () => {
    const a = mulberry32(123)
    const b = mulberry32(123)
    const seqA = [a(), a(), a()]
    const seqB = [b(), b(), b()]
    expect(seqA).toEqual(seqB)
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe("hashPosition", () => {
  it("returns the same point for the same id every time", () => {
    expect(hashPosition("abc")).toEqual(hashPosition("abc"))
  })

  it("stays inside the unit square", () => {
    for (const id of ["a", "b", "some-uuid-like-value", "Ω"]) {
      const p = hashPosition(id)
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThan(1)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeLessThan(1)
    }
  })

  it("gives a different point under a different seed namespace", () => {
    expect(hashPosition("abc", "galaxy")).not.toEqual(hashPosition("abc", "stars"))
  })
})

describe("radiusForCount", () => {
  it("grows with count but sublinearly (area-proportional)", () => {
    const r1 = radiusForCount(1)
    const r4 = radiusForCount(4)
    const r16 = radiusForCount(16)
    expect(r4).toBeGreaterThan(r1)
    expect(r16).toBeGreaterThan(r4)
    // doubling the radius contribution requires 4x the count
    expect(r16 - 16).toBeCloseTo(2 * (r4 - 16), 5)
  })

  it("clamps at the maximum", () => {
    expect(radiusForCount(100000)).toBe(54)
  })

  it("treats zero and negative counts as the minimum", () => {
    expect(radiusForCount(0)).toBe(16)
    expect(radiusForCount(-5)).toBe(16)
  })
})

describe("relaxCollisions", () => {
  it("separates two fully overlapping circles", () => {
    const nodes: LayoutNode[] = [
      { id: "a", x: 500, y: 300, r: 30 },
      { id: "b", x: 500, y: 300, r: 30 },
    ]
    const out = relaxCollisions(nodes)
    const dist = Math.hypot(out[0].x - out[1].x, out[0].y - out[1].y)
    expect(dist).toBeGreaterThan(60)
  })

  it("leaves already-separated circles essentially alone", () => {
    const nodes: LayoutNode[] = [
      { id: "a", x: 200, y: 300, r: 20 },
      { id: "b", x: 800, y: 300, r: 20 },
    ]
    const out = relaxCollisions(nodes)
    expect(out[0].x).toBeCloseTo(200, 5)
    expect(out[1].x).toBeCloseTo(800, 5)
  })

  it("keeps every node inside the bounds", () => {
    const nodes: LayoutNode[] = Array.from({ length: 12 }, (_, i) => ({
      id: `n${i}`,
      x: 500,
      y: 300,
      r: 24,
    }))
    const out = relaxCollisions(nodes)
    for (const n of out) {
      expect(n.x).toBeGreaterThanOrEqual(0)
      expect(n.x).toBeLessThanOrEqual(GALAXY_WIDTH)
      expect(n.y).toBeGreaterThanOrEqual(0)
      expect(n.y).toBeLessThanOrEqual(GALAXY_HEIGHT)
    }
  })

  it("is deterministic", () => {
    const nodes: LayoutNode[] = [
      { id: "a", x: 500, y: 300, r: 30 },
      { id: "b", x: 505, y: 302, r: 30 },
      { id: "c", x: 495, y: 298, r: 30 },
    ]
    expect(relaxCollisions(nodes)).toEqual(relaxCollisions(nodes))
  })

  it("does not mutate its input", () => {
    const nodes: LayoutNode[] = [
      { id: "a", x: 500, y: 300, r: 30 },
      { id: "b", x: 500, y: 300, r: 30 },
    ]
    relaxCollisions(nodes)
    expect(nodes[0]).toEqual({ id: "a", x: 500, y: 300, r: 30 })
  })
})

describe("layoutGalaxy", () => {
  const items = [
    { id: "plato", count: 14 },
    { id: "strategy", count: 5 },
    { id: "context", count: 4 },
    { id: "mdspin", count: 2 },
    { id: "gating", count: 1 },
    { id: "churn", count: 1 },
    { id: "__unfiled__", count: 2 },
  ]

  it("places every item exactly once, preserving ids", () => {
    const out = layoutGalaxy(items)
    expect(out.map((n) => n.id).sort()).toEqual(items.map((i) => i.id).sort())
  })

  it("is deterministic across calls", () => {
    expect(layoutGalaxy(items)).toEqual(layoutGalaxy(items))
  })

  it("gives the biggest project the biggest radius", () => {
    const out = layoutGalaxy(items)
    const byId = new Map(out.map((n) => [n.id, n]))
    expect(byId.get("plato")!.r).toBeGreaterThan(byId.get("churn")!.r)
  })

  it("leaves no two planets overlapping", () => {
    const out = layoutGalaxy(items)
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const dist = Math.hypot(out[i].x - out[j].x, out[i].y - out[j].y)
        expect(dist).toBeGreaterThan(out[i].r + out[j].r)
      }
    }
  })

  it("handles an empty vault and a single project", () => {
    expect(layoutGalaxy([])).toEqual([])
    const one = layoutGalaxy([{ id: "solo", count: 3 }])
    expect(one).toHaveLength(1)
    expect(one[0].id).toBe("solo")
  })

  it("does not move a project when an unrelated project is added", () => {
    // Positions are hashed per id, so adding a distant project must not reshuffle the rest.
    // (Only collision relaxation can shift things, and these two don't collide.)
    const a = layoutGalaxy([{ id: "plato", count: 14 }])
    const b = layoutGalaxy([{ id: "plato", count: 14 }, { id: "faraway", count: 1 }])
    const plataA = a.find((n) => n.id === "plato")!
    const platoB = b.find((n) => n.id === "plato")!
    expect(Math.hypot(plataA.x - platoB.x, plataA.y - platoB.y)).toBeLessThan(120)
  })
})

describe("layoutRing", () => {
  it("spaces moons evenly around the parent", () => {
    const out = layoutRing(
      [
        { id: "m1", count: 2 },
        { id: "m2", count: 1 },
        { id: "m3", count: 3 },
      ],
      { cx: 500, cy: 300, radius: 140 }
    )
    expect(out).toHaveLength(3)
    const angles = out.map((n) => Math.atan2(n.y - 300, n.x - 500))
    const uniq = new Set(angles.map((a) => a.toFixed(4)))
    expect(uniq.size).toBe(3)
    for (const n of out) {
      expect(Math.hypot(n.x - 500, n.y - 300)).toBeCloseTo(140, 5)
    }
  })

  it("applies scaleX to make the orbit elliptical", () => {
    const out = layoutRing([{ id: "m1", count: 1 }, { id: "m2", count: 1 }], {
      cx: 500,
      cy: 300,
      radius: 100,
      scaleX: 2,
    })
    // first moon sits at the top (angle -90°), so scaleX shouldn't move it horizontally
    expect(out[0].x).toBeCloseTo(500, 5)
    expect(out[0].y).toBeCloseTo(200, 5)
  })

  it("returns an empty array for no subprojects", () => {
    expect(layoutRing([], { cx: 500, cy: 300, radius: 140 })).toEqual([])
  })
})

describe("relaxCollisions with fixed nodes", () => {
  it("never moves a fixed node, and pushes the free one clear", () => {
    const out = relaxCollisions(
      [
        { id: "anchor", x: 500, y: 310, r: 46, fixed: true },
        { id: "doc", x: 505, y: 312, r: 7 },
      ],
      { padding: 10, clampToBounds: false }
    )
    const anchor = out.find((n) => n.id === "anchor")!
    const doc = out.find((n) => n.id === "doc")!
    expect(anchor.x).toBe(500)
    expect(anchor.y).toBe(310)
    expect(Math.hypot(doc.x - 500, doc.y - 310)).toBeGreaterThanOrEqual(46 + 7)
  })

  it("leaves two fixed nodes alone rather than fighting them apart", () => {
    const out = relaxCollisions([
      { id: "a", x: 500, y: 310, r: 40, fixed: true },
      { id: "b", x: 505, y: 310, r: 40, fixed: true },
    ])
    expect(out[0].x).toBe(500)
    expect(out[1].x).toBe(505)
  })

  it("does not clamp a fixed node to the bounds", () => {
    const out = relaxCollisions([{ id: "a", x: -200, y: -200, r: 20, fixed: true }])
    expect(out[0].x).toBe(-200)
    expect(out[0].y).toBe(-200)
  })
})

describe("relaxCollisions aspect and clamping", () => {
  it("demands more horizontal separation than vertical when aspect > 1", () => {
    const horizontal = relaxCollisions(
      [
        { id: "a", x: 480, y: 310, r: 7 },
        { id: "b", x: 520, y: 310, r: 7 },
      ],
      { aspect: 4, padding: 20, clampToBounds: false }
    )
    const vertical = relaxCollisions(
      [
        { id: "a", x: 500, y: 290, r: 7 },
        { id: "b", x: 500, y: 330, r: 7 },
      ],
      { aspect: 4, padding: 20, clampToBounds: false }
    )
    const hGap = Math.abs(horizontal[0].x - horizontal[1].x)
    const vGap = Math.abs(vertical[0].y - vertical[1].y)
    expect(hGap).toBeGreaterThan(vGap * 2)
  })

  it("lets nodes leave the canvas when clampToBounds is false", () => {
    const many: LayoutNode[] = Array.from({ length: 30 }, (_, i) => ({
      id: `n${i}`,
      x: 500,
      y: 310,
      r: 20,
    }))
    const out = relaxCollisions(many, { clampToBounds: false, padding: 40 })
    const escaped = out.some(
      (n) => n.x < 0 || n.x > GALAXY_WIDTH || n.y < 0 || n.y > GALAXY_HEIGHT
    )
    expect(escaped).toBe(true)
  })
})

describe("layoutGalaxy pinned positions", () => {
  const items = [
    { id: "plato", count: 14 },
    { id: "mdspin", count: 2 },
  ]

  it("places a pinned planet exactly where it was dropped", () => {
    const out = layoutGalaxy(items, { pinned: { plato: { x: 123, y: 456 } } })
    const plato = out.find((n) => n.id === "plato")!
    expect(plato.x).toBe(123)
    expect(plato.y).toBe(456)
  })

  it("moves the unpinned neighbour out of the way instead of the pinned one", () => {
    // Drop the pin right on top of where mdspin would otherwise sit.
    const natural = layoutGalaxy(items)
    const mdspinNatural = natural.find((n) => n.id === "mdspin")!
    const out = layoutGalaxy(items, {
      pinned: { plato: { x: mdspinNatural.x, y: mdspinNatural.y } },
    })
    const plato = out.find((n) => n.id === "plato")!
    const mdspin = out.find((n) => n.id === "mdspin")!
    expect(plato.x).toBe(mdspinNatural.x)
    expect(plato.y).toBe(mdspinNatural.y)
    expect(Math.hypot(mdspin.x - plato.x, mdspin.y - plato.y)).toBeGreaterThan(plato.r + mdspin.r)
  })

  it("ignores pins for nodes that aren't present", () => {
    const out = layoutGalaxy(items, { pinned: { ghost: { x: 10, y: 10 } } })
    expect(out.map((n) => n.id).sort()).toEqual(["mdspin", "plato"])
  })
})

describe("layoutScatter", () => {
  const ids = Array.from({ length: 30 }, (_, i) => `doc-${i}`)
  const opts = { cx: 500, cy: 310, inner: 200, outer: 300 }

  it("keeps every document within the annulus band", () => {
    for (const n of layoutScatter(ids, opts)) {
      const dist = Math.hypot(n.x - 500, n.y - 310)
      expect(dist).toBeGreaterThanOrEqual(200 - 0.001)
      expect(dist).toBeLessThanOrEqual(300 + 0.001)
    }
  })

  it("is deterministic, and independent of which siblings are present", () => {
    const all = layoutScatter(ids, opts)
    expect(all).toEqual(layoutScatter(ids, opts))
    expect(layoutScatter(["doc-7"], opts)[0]).toEqual(all.find((n) => n.id === "doc-7"))
  })

  it("is genuinely irregular rather than evenly spaced", () => {
    const out = layoutScatter(ids, opts)
    const angles = out.map((n) => Math.atan2(n.y - 310, n.x - 500)).sort((a, b) => a - b)
    const gaps = angles.slice(1).map((a, i) => a - angles[i])
    const mean = gaps.reduce((x, y) => x + y, 0) / gaps.length
    const spread = Math.max(...gaps) - Math.min(...gaps)
    // An even ring would have near-identical gaps; a scatter should vary a lot.
    expect(spread).toBeGreaterThan(mean)
  })

  it("handles zero documents", () => {
    expect(layoutScatter([], opts)).toEqual([])
  })
})

describe("layoutRings", () => {
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `doc-${i}`)

  it("places every document exactly once", () => {
    const out = layoutRings(ids(11), {
      cx: 500,
      cy: 310,
      inner: 210,
      ringGap: 80,
      minSpacing: 118,
      scaleX: 1.5,
    })
    expect(out.map((n) => n.id)).toEqual(ids(11))
  })

  it("keeps a small set on a single ring", () => {
    const out = layoutRings(ids(11), {
      cx: 500,
      cy: 310,
      inner: 210,
      ringGap: 80,
      minSpacing: 118,
      scaleX: 1.5,
    })
    // Every node on the same ellipse ⇒ same normalised radius
    const norm = out.map((n) => Math.hypot((n.x - 500) / 1.5, n.y - 310))
    for (const d of norm) expect(d).toBeCloseTo(210, 0)
  })

  it("spills onto further rings once a ring is full", () => {
    const out = layoutRings(ids(60), {
      cx: 500,
      cy: 310,
      inner: 210,
      ringGap: 80,
      minSpacing: 118,
      scaleX: 1.5,
    })
    const radii = new Set(
      out.map((n) => Math.round(Math.hypot((n.x - 500) / 1.5, n.y - 310) / 10) * 10)
    )
    expect(radii.size).toBeGreaterThan(1)
  })

  it("separates neighbours by at least roughly the requested spacing", () => {
    const out = layoutRings(ids(8), {
      cx: 500,
      cy: 310,
      inner: 210,
      ringGap: 80,
      minSpacing: 118,
      scaleX: 1,
    })
    // Nearest-neighbour distance should be in the ballpark of minSpacing (jitter aside)
    for (let i = 0; i < out.length; i++) {
      let nearest = Infinity
      for (let j = 0; j < out.length; j++) {
        if (i === j) continue
        nearest = Math.min(nearest, Math.hypot(out[i].x - out[j].x, out[i].y - out[j].y))
      }
      expect(nearest).toBeGreaterThan(100)
    }
  })

  it("is deterministic and handles zero documents", () => {
    const opts = { cx: 500, cy: 310, inner: 210, ringGap: 80, minSpacing: 118 }
    expect(layoutRings(ids(9), opts)).toEqual(layoutRings(ids(9), opts))
    expect(layoutRings([], opts)).toEqual([])
  })
})

describe("boundsOf / computeFitView", () => {
  it("covers every node including its radius", () => {
    const b = boundsOf([
      { id: "a", x: 100, y: 100, r: 20 },
      { id: "b", x: 300, y: 200, r: 10 },
    ])
    expect(b).toEqual({ minX: 80, minY: 80, maxX: 310, maxY: 210 })
  })

  it("applies padding", () => {
    const b = boundsOf([{ id: "a", x: 100, y: 100, r: 10 }], 15)
    expect(b).toEqual({ minX: 75, minY: 75, maxX: 125, maxY: 125 })
  })

  it("falls back to the full canvas when there are no nodes", () => {
    expect(boundsOf([])).toEqual({ minX: 0, minY: 0, maxX: GALAXY_WIDTH, maxY: GALAXY_HEIGHT })
  })

  it("centres the bounds in the viewport", () => {
    const b = { minX: 0, minY: 0, maxX: 500, maxY: 310 }
    const v = computeFitView(b, 1000, 620)
    // bounds centre (250,155) must land at viewport centre (500,310)
    expect(250 * v.scale + v.tx).toBeCloseTo(500, 5)
    expect(155 * v.scale + v.ty).toBeCloseTo(310, 5)
  })

  it("shrinks to fit oversized content", () => {
    const v = computeFitView({ minX: 0, minY: 0, maxX: 2000, maxY: 620 }, 1000, 620)
    expect(v.scale).toBeCloseTo(0.5, 5)
  })

  it("never magnifies past maxScale", () => {
    const v = computeFitView({ minX: 400, minY: 280, maxX: 600, maxY: 340 }, 1000, 620, 1)
    expect(v.scale).toBe(1)
  })
})

describe("zoomAround", () => {
  const view = { scale: 1, tx: 0, ty: 0 }

  it("keeps the anchor point pinned under the cursor", () => {
    const next = zoomAround(view, 300, 200, 2)
    expect(300 * next.scale + next.tx).toBeCloseTo(300 * view.scale + view.tx, 5)
    expect(200 * next.scale + next.ty).toBeCloseTo(200 * view.scale + view.ty, 5)
  })

  it("clamps to the scale limits", () => {
    expect(zoomAround(view, 0, 0, 1000, 0.4, 8).scale).toBe(8)
    expect(zoomAround(view, 0, 0, 0.0001, 0.4, 8).scale).toBe(0.4)
  })

  it("round-trips zoom in then out back to the original transform", () => {
    const inOnce = zoomAround(view, 300, 200, 2)
    const backOut = zoomAround(inOnce, 300, 200, 0.5)
    expect(backOut.scale).toBeCloseTo(1, 5)
    expect(backOut.tx).toBeCloseTo(0, 5)
    expect(backOut.ty).toBeCloseTo(0, 5)
  })
})

describe("generateStarfield", () => {
  it("produces the requested number of stars, deterministically", () => {
    const a = generateStarfield(50)
    const b = generateStarfield(50)
    expect(a).toHaveLength(50)
    expect(a).toEqual(b)
  })

  it("keeps stars inside the canvas with sane radius and opacity", () => {
    for (const s of generateStarfield(200)) {
      expect(s.x).toBeGreaterThanOrEqual(0)
      expect(s.x).toBeLessThanOrEqual(GALAXY_WIDTH)
      expect(s.y).toBeGreaterThanOrEqual(0)
      expect(s.y).toBeLessThanOrEqual(GALAXY_HEIGHT)
      expect(s.r).toBeGreaterThan(0)
      expect(s.o).toBeGreaterThan(0)
      expect(s.o).toBeLessThanOrEqual(1)
    }
  })
})
