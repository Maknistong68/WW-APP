// The "Live site" world: one big octagon on the coast, several km across.
// Grid: 1 tile = 1 world unit, x to the right (east), +z towards the camera
// (south, the sea). From north to south: desert → land half (industrial grid)
// → spine road → harbour basin → floating city → open sea.
//
// The octagon is the site boundary around everything: |x| ≤ GRID, |z| ≤ GRID,
// |x| + |z| ≤ OCT. Its north half is on land, its south half out in the sea.

export type XZ = [number, number]

export interface Rect {
  x0: number
  z0: number
  x1: number
  z1: number
}

/** Half the octagon's width. */
export const GRID = 100
/** Corner cut: |x| + |z| ≤ OCT (≈ GRID·√2, a regular octagon). */
export const OCT = 141
/** How far the map reaches: |x| ≤ WORLD, -WORLD ≤ z ≤ GRID. */
export const WORLD = 150
/** The natural coastline outside the octagon: the mainland is z ≤ COAST. */
export const COAST = 0
/** Default north quay of the harbour basin; coast sites sit on it. */
export const QUAY = 8

/** Octagon outline, clockwise from the north-west. */
export const OCTAGON: XZ[] = [
  [-(OCT - GRID), -GRID],
  [OCT - GRID, -GRID],
  [GRID, -(OCT - GRID)],
  [GRID, OCT - GRID],
  [OCT - GRID, GRID],
  [-(OCT - GRID), GRID],
  [-GRID, OCT - GRID],
  [-GRID, -(OCT - GRID)],
]

/** The octagon's land half (north of the coastline). */
export const OCTAGON_LAND: XZ[] = [
  [-(OCT - GRID), -GRID],
  [OCT - GRID, -GRID],
  [GRID, -(OCT - GRID)],
  [GRID, COAST],
  [-GRID, COAST],
  [-GRID, -(OCT - GRID)],
]

export const insideOctagon = (x: number, z: number) => Math.abs(x) <= GRID && Math.abs(z) <= GRID && Math.abs(x) + Math.abs(z) <= OCT
/** Inside the map. */
export const insideWorld = (x: number, z: number) => Math.abs(x) <= WORLD && z >= -WORLD && z <= GRID

/** Keep a point on the map. */
export const clampWorld = (x: number, z: number): XZ => [Math.max(-WORLD, Math.min(WORLD, x)), Math.max(-WORLD, Math.min(GRID, z))]

export const inRect = (r: Rect, x: number, z: number) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1
export const rectsOverlap = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1

/** Even-odd point-in-polygon test. */
export function inPoly(poly: XZ[], x: number, z: number) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]
    const [xj, zj] = poly[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

/** Polygon centre (area-weighted; falls back to the average of the corners). */
export function centroid(poly: XZ[]): XZ {
  let a = 0
  let cx = 0
  let cz = 0
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const f = poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1]
    a += f
    cx += (poly[j][0] + poly[i][0]) * f
    cz += (poly[j][1] + poly[i][1]) * f
  }
  if (Math.abs(a) < 1e-6) {
    const n = Math.max(1, poly.length)
    return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n]
  }
  return [cx / (3 * a), cz / (3 * a)]
}

/** a minus b, as up to 4 rectangles (north strip, south strip, west and east blocks). */
export function rectMinus(a: Rect, b: Rect): Rect[] {
  if (!rectsOverlap(a, b)) return [a]
  const out: Rect[] = []
  const z0 = Math.max(a.z0, b.z0)
  const z1 = Math.min(a.z1, b.z1)
  if (b.z0 > a.z0) out.push({ x0: a.x0, z0: a.z0, x1: a.x1, z1: b.z0 })
  if (b.z1 < a.z1) out.push({ x0: a.x0, z0: b.z1, x1: a.x1, z1: a.z1 })
  if (b.x0 > a.x0) out.push({ x0: a.x0, z0, x1: b.x0, z1 })
  if (b.x1 < a.x1) out.push({ x0: b.x1, z0, x1: a.x1, z1 })
  return out
}

/** A convex polygon clipped to a rectangle (Sutherland–Hodgman). */
export function clipToRect(poly: XZ[], r: Rect): XZ[] {
  const edges: [(p: XZ) => number, (a: XZ, b: XZ) => XZ][] = [
    [(p) => p[0] - r.x0, (a, b) => [r.x0, a[1] + ((b[1] - a[1]) * (r.x0 - a[0])) / (b[0] - a[0])]],
    [(p) => r.x1 - p[0], (a, b) => [r.x1, a[1] + ((b[1] - a[1]) * (r.x1 - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] - r.z0, (a, b) => [a[0] + ((b[0] - a[0]) * (r.z0 - a[1])) / (b[1] - a[1]), r.z0]],
    [(p) => r.z1 - p[1], (a, b) => [a[0] + ((b[0] - a[0]) * (r.z1 - a[1])) / (b[1] - a[1]), r.z1]],
  ]
  let out = poly
  for (const [side, cut] of edges) {
    const src = out
    out = []
    for (let i = 0; i < src.length; i++) {
      const a = src[i]
      const b = src[(i + 1) % src.length]
      const ia = side(a) >= 0
      const ib = side(b) >= 0
      if (ia) out.push(a)
      if (ia !== ib) out.push(cut(a, b))
    }
    if (out.length === 0) return out
  }
  return out
}
