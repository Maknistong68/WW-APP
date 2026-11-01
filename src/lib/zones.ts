import { COAST, inPoly, inRect, rectMinus, rectsOverlap, type Rect, type XZ } from './world'
import { DEFAULT_ITEMS, rectCorners, type MapItem } from './mapItems'

// The city's zones, read from the map items so the Admin can reshape them:
// the industrial zone (land half), the port land with the harbour basin cut
// into it, the entrance pier and the floating city. What is land, what is
// water, where the quay is, and the procedural blocks that fill the zones.
// Pure and deterministic (the same city on every device).

export interface Zones {
  industry: XZ[][]
  port: Rect[]
  basin: Rect[]
  pier: XZ[][]
  city: XZ[][]
}

export function rectOf(pts: XZ[]): Rect {
  const c = rectCorners(pts)
  return { x0: c[0][0], z0: c[0][1], x1: c[2][0], z1: c[2][1] }
}

export function zonesOf(items: MapItem[]): Zones {
  const z: Zones = { industry: [], port: [], basin: [], pier: [], city: [] }
  for (const i of items) {
    const p = i.points ?? []
    if (i.kind === 'port' || i.kind === 'basin') {
      if (p.length >= 2) z[i.kind].push(rectOf(p))
    } else if (i.kind === 'industry' || i.kind === 'pier' || i.kind === 'city') {
      if (p.length >= 3) z[i.kind].push(p)
    }
  }
  return z
}

export const DEFAULT_ZONE_SET: Zones = zonesOf(DEFAULT_ITEMS)

export const inBasin = (zs: Zones, x: number, z: number) => zs.basin.some((r) => inRect(r, x, z))
export const inCity = (zs: Zones, x: number, z: number) => zs.city.some((p) => inPoly(p, x, z))

/** Solid ground to build on: the mainland, the port land and the pier, minus the basin. The floating city isn't built yet. */
export function onLand(zs: Zones, x: number, z: number) {
  if (inBasin(zs, x, z)) return false
  if (z <= COAST) return true
  return zs.port.some((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) || zs.pier.some((p) => inPoly(p, x, z))
}

export const isWater = (zs: Zones, x: number, z: number) => !onLand(zs, x, z) && !inCity(zs, x, z)

/** The basin's north quay: where the cranes, berths and coast sites are. */
export function quayOf(zs: Zones): { z: number; x0: number; x1: number } | null {
  const b = zs.basin[0]
  return b ? { z: b.z0, x0: b.x0, x1: b.x1 } : null
}

/** The mainland, reaching well past the map so the horizon is desert. */
export const MAINLAND: Rect = { x0: -460, z0: -460, x1: 460, z1: COAST }

/** Land as rectangles (the basin cut out) for drawing: mainland pieces and port pieces. */
export function landPieces(zs: Zones): { mainland: Rect[]; port: Rect[] } {
  const cut = (rs: Rect[]) => zs.basin.reduce((acc, b) => acc.flatMap((r) => rectMinus(r, b)), rs)
  return { mainland: cut([MAINLAND]), port: cut(zs.port) }
}

const hash = (i: number, j: number, s = 0) => {
  const h = Math.sin(i * 127.1 + j * 311.7 + s * 74.7) * 43758.5453
  return h - Math.floor(h)
}

// ---------------------------------------------------------------------------
// Floating city: a dense grid of blocks with canals between them and some
// square water pockets. Only a silhouette — it isn't built yet.
// ---------------------------------------------------------------------------

export interface CityBlock extends Rect {
  /** Building heights on this block (1–4 low blocks, taller towards the middle), in tiles. */
  h: number[]
  seed: number
}

export const CITY_PITCH = 8
export const CANAL = 1.4

export function cityBlocks(poly: XZ[], pitch = CITY_PITCH, canal = CANAL): CityBlock[] {
  if (poly.length < 3) return []
  const xs = poly.map((p) => p[0])
  const zs = poly.map((p) => p[1])
  const out: CityBlock[] = []
  const [cx, cz] = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2]
  const span = Math.max(1, (Math.max(...xs) - Math.min(...xs)) / 2)
  // the grid starts at the outline's north-west corner, so the first row fits
  const ox = Math.min(...xs)
  const oz = Math.min(...zs)
  for (let i = 0; ox + i * pitch < Math.max(...xs); i++) {
    for (let j = 0; oz + j * pitch < Math.max(...zs); j++) {
      const r = { x0: ox + i * pitch + canal / 2, z0: oz + j * pitch + canal / 2, x1: ox + (i + 1) * pitch - canal / 2, z1: oz + (j + 1) * pitch - canal / 2 }
      const corners: XZ[] = [
        [r.x0, r.z0],
        [r.x1, r.z0],
        [r.x1, r.z1],
        [r.x0, r.z1],
      ]
      if (!corners.every(([x, z]) => inPoly(poly, x, z))) continue
      // a square water pocket every few blocks
      if (hash(i, j) < 0.13) continue
      const mid = (r.x0 + r.x1) / 2
      const near = 1 - Math.min(1, Math.hypot(mid - cx, (r.z0 + r.z1) / 2 - cz) / span)
      const n = 1 + Math.floor(hash(i, j, 1) * 4)
      const h = Array.from({ length: n }, (_, k) => 0.3 + hash(i, j, k + 2) * (0.5 + near * 1.8))
      out.push({ ...r, h, seed: Math.floor(hash(i, j, 9) * 1e6) })
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Industrial zone: lots in a neat grid between the streets (factories,
// warehouses, solar, tanks, laydown yards), kept off the roads, the sites and
// the camps.
// ---------------------------------------------------------------------------

export type LotKind = 'warehouse' | 'factory' | 'solar' | 'tanks' | 'yard'
export interface Lot extends Rect {
  kind: LotKind
  seed: number
}

/** Lots line up with the default streets: avenues every 15 tiles from x = 0, cross streets every 14 from z = -50. */
export const LOT = { px: 15, pz: 14, oz: -50, margin: 1.5 }

export interface RoadLine {
  points: XZ[]
  width: number
}

/** Does a road run through (or right next to) this rectangle? */
export function nearRoad(r: Rect, roads: RoadLine[]) {
  for (const road of roads) {
    const pad = road.width / 2 + 0.1
    const box = { x0: r.x0 - pad, z0: r.z0 - pad, x1: r.x1 + pad, z1: r.z1 + pad }
    const pts = road.points
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i]
      const [bx, bz] = pts[i + 1]
      // quick reject on the segment's bounding box
      if (Math.max(ax, bx) < box.x0 || Math.min(ax, bx) > box.x1 || Math.max(az, bz) < box.z0 || Math.min(az, bz) > box.z1) continue
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.7))
      for (let k = 0; k <= n; k++) if (inRect(box, ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n)) return true
    }
  }
  return false
}

const LOT_KINDS: [LotKind, number][] = [
  ['warehouse', 0.3],
  ['factory', 0.5],
  ['solar', 0.7],
  ['tanks', 0.84],
  ['yard', 1],
]

export function industryLots(zs: Zones, blockers: Rect[], roads: RoadLine[]): Lot[] {
  const out: Lot[] = []
  const m = LOT.margin
  for (const poly of zs.industry) {
    const xs = poly.map((p) => p[0])
    const zz = poly.map((p) => p[1])
    for (let i = Math.floor(Math.min(...xs) / LOT.px); i * LOT.px < Math.max(...xs); i++) {
      for (let j = Math.floor((Math.min(...zz) - LOT.oz) / LOT.pz); LOT.oz + j * LOT.pz < Math.max(...zz); j++) {
        const r = { x0: i * LOT.px + m, z0: LOT.oz + j * LOT.pz + m, x1: (i + 1) * LOT.px - m, z1: LOT.oz + (j + 1) * LOT.pz - m }
        const corners: XZ[] = [
          [r.x0, r.z0],
          [r.x1, r.z0],
          [r.x1, r.z1],
          [r.x0, r.z1],
        ]
        if (!corners.every(([x, z]) => inPoly(poly, x, z) && onLand(zs, x, z))) continue
        const grown = { x0: r.x0 - 1, z0: r.z0 - 1, x1: r.x1 + 1, z1: r.z1 + 1 }
        if (blockers.some((b) => rectsOverlap(grown, b))) continue
        if (nearRoad(r, roads)) continue
        const h = hash(i, j, 5)
        const kind = LOT_KINDS.find(([, p]) => h < p)![0]
        out.push({ ...r, kind, seed: Math.floor(hash(i, j, 6) * 1e6) })
      }
    }
  }
  return out
}
