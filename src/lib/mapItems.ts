import { GRID, OCT, WORLD, clampWorld, type XZ } from './world'

// Everything the Admin can change on the "Live site" map besides the sites:
// roads and highways (lines), palm trees (single or in rows), workers' camps
// and villages (blocks), and the zones of the city (industrial zone, port
// land, harbour basin, entrance pier, floating city — polygons). Shared with
// the team like the site layout; the default items have fixed ids so they can
// be moved, reshaped or removed too. Pure helpers only.

export type { XZ }
export type LineKind = 'road' | 'highway'
export type BlockKind = 'camp' | 'village'
export type ZoneKind = 'industry' | 'port' | 'basin' | 'pier' | 'city'
export type ItemKind = LineKind | 'trees' | BlockKind | ZoneKind

export interface MapItem {
  uuid: string
  kind: ItemKind
  /** Roads / highways: the line; trees: one point per palm; zones: the outline. */
  points?: XZ[]
  /** Camps / villages: centre and quarter turns. */
  x?: number
  z?: number
  rot?: number
}

/** What a saved row looks like (removed = hidden, so default items can be deleted too). */
export interface MapItemRow {
  uuid: string
  kind?: string
  points?: unknown
  x?: number
  z?: number
  rot?: number
  removed?: boolean
  /** Map format; missing = the small octagon of the first versions. */
  v?: number
}

/** 3 = the city-scale octagon. Older rows were drawn on the small octagon. */
export const MAP_VERSION = 3
/** Older rows move with the sites (the land half moved 6 tiles north). */
const OLD_SHIFT_Z = -6

export const ROAD_WIDTH = { road: 1.1, highway: 2.8 } as const
/** Block footprint (w along x, d along z) before turning. */
export const BLOCK_SIZE = { camp: [11, 7], village: [9, 9] } as const
/** Smallest side of a rectangular zone. */
export const MIN_RECT = 4

export const ZONE_KINDS: ZoneKind[] = ['industry', 'port', 'basin', 'pier', 'city']

export const ITEM_LABEL: Record<ItemKind, string> = {
  road: 'road',
  highway: 'highway',
  trees: 'palm trees',
  camp: 'workers’ camp',
  village: 'village',
  industry: 'industrial zone',
  port: 'port land',
  basin: 'harbour basin',
  pier: 'entrance pier',
  city: 'floating city',
}

export const isLine = (k: ItemKind): k is LineKind => k === 'road' || k === 'highway'
export const isBlock = (k: ItemKind): k is BlockKind => k === 'camp' || k === 'village'
export const isZone = (k: ItemKind): k is ZoneKind => (ZONE_KINDS as string[]).includes(k)
/** Rectangular zones keep square corners when a corner is dragged. */
export const isRectZone = (k: ItemKind): k is 'port' | 'basin' => k === 'port' || k === 'basin'
const isKind = (k: unknown): k is ItemKind => typeof k === 'string' && k in ITEM_LABEL

/** Snap to half tiles and keep it on the map. */
export function snapPoint(x: number, z: number, step = 0.5): XZ {
  const [cx, cz] = clampWorld(x, z)
  return [Math.round(cx / step) * step, Math.round(cz / step) * step]
}

const stepOf = (k: ItemKind) => (k === 'trees' ? 0.25 : 0.5)

/** Palms every `gap` tiles from a to b (both ends included). */
export function treeRow(a: XZ, b: XZ, gap = 2): XZ[] {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const n = Math.max(1, Math.round(len / gap))
  return Array.from({ length: n + 1 }, (_, i) => snapPoint(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, 0.25))
}

export function blockSize(item: MapItem): [number, number] {
  if (!isBlock(item.kind)) return [0, 0]
  const [w, d] = BLOCK_SIZE[item.kind]
  return (item.rot ?? 0) % 2 ? [d, w] : [w, d]
}

/** Keep a block's whole footprint on the map. */
function clampBlock(item: MapItem): MapItem {
  const [w, d] = blockSize(item)
  const x = Math.max(-WORLD + w / 2, Math.min(WORLD - w / 2, item.x ?? 0))
  const z = Math.max(-WORLD + d / 2, Math.min(GRID - d / 2, item.z ?? 0))
  return { ...item, x: Math.round(x * 2) / 2, z: Math.round(z * 2) / 2 }
}

/** The 4 corners of a rectangle zone in a fixed order: NW, NE, SE, SW. */
export function rectCorners(pts: XZ[]): XZ[] {
  const xs = pts.map((p) => p[0])
  const zs = pts.map((p) => p[1])
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const z0 = Math.min(...zs)
  const z1 = Math.max(...zs)
  return [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ]
}

/** Move a whole item (it keeps its shape and stays on the map). */
export function moveItem(item: MapItem, dx: number, dz: number): MapItem {
  if (isBlock(item.kind)) return clampBlock({ ...item, x: (item.x ?? 0) + dx, z: (item.z ?? 0) + dz })
  const pts = item.points ?? []
  // shift as one piece, but never past the edge of the map
  let ddx = dx
  let ddz = dz
  for (const [x, z] of pts) {
    const [cx, cz] = clampWorld(x + ddx, z + ddz)
    ddx = cx - x
    ddz = cz - z
  }
  return { ...item, points: pts.map(([x, z]) => snapPoint(x + ddx, z + ddz, stepOf(item.kind))) }
}

/** Drag one corner of a rectangle: the two corners next to it follow, so it stays a rectangle. */
function moveRectCorner(pts: XZ[], i: number, x: number, z: number): XZ[] {
  const c = pts[i]
  const o = pts[(i + 2) % 4]
  const sx = Math.sign(c[0] - o[0]) || 1
  const sz = Math.sign(c[1] - o[1]) || 1
  const nx = sx > 0 ? Math.max(x, o[0] + MIN_RECT) : Math.min(x, o[0] - MIN_RECT)
  const nz = sz > 0 ? Math.max(z, o[1] + MIN_RECT) : Math.min(z, o[1] - MIN_RECT)
  const next = pts.map((p) => [p[0], p[1]] as XZ)
  next[i] = [nx, nz]
  for (const k of [(i + 1) % 4, (i + 3) % 4]) {
    if (pts[k][0] === c[0]) next[k][0] = nx
    if (pts[k][1] === c[1]) next[k][1] = nz
  }
  return next
}

/** Move one point: a road corner, one palm or a zone corner. */
export function movePoint(item: MapItem, index: number, x: number, z: number): MapItem {
  const pts = [...(item.points ?? [])]
  if (index < 0 || index >= pts.length) return item
  const p = snapPoint(x, z, stepOf(item.kind))
  if (isRectZone(item.kind) && pts.length === 4) return { ...item, points: moveRectCorner(pts, index, p[0], p[1]) }
  pts[index] = p
  return { ...item, points: pts }
}

/** Least points an item needs. */
const minPoints = (k: ItemKind) => (isZone(k) ? 3 : isLine(k) ? 2 : 1)

/** Can this one point be removed (and the item still make sense)? */
export const canRemovePoint = (item: MapItem) => !isRectZone(item.kind) && (item.points?.length ?? 0) > minPoints(item.kind)

/** Remove one point (a palm, a road corner, a zone corner). Returns null when nothing is left. */
export function removePoint(item: MapItem, index: number): MapItem | null {
  if (isRectZone(item.kind)) return item
  const pts = (item.points ?? []).filter((_, i) => i !== index)
  if (pts.length < minPoints(item.kind)) return null
  return { ...item, points: pts }
}

/** Add a corner to a zone halfway between corner `index` and the next one. */
export function addCorner(item: MapItem, index: number): MapItem {
  const pts = item.points ?? []
  if (!isZone(item.kind) || isRectZone(item.kind) || index < 0 || index >= pts.length) return item
  const a = pts[index]
  const b = pts[(index + 1) % pts.length]
  const mid = snapPoint((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
  return { ...item, points: [...pts.slice(0, index + 1), mid, ...pts.slice(index + 1)] }
}

export function rotateItem(item: MapItem): MapItem {
  if (!isBlock(item.kind)) return item
  return clampBlock({ ...item, rot: ((item.rot ?? 0) + 1) % 4 })
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const okPoints = (p: unknown): p is XZ[] => Array.isArray(p) && p.every((q) => Array.isArray(q) && q.length === 2 && finite(q[0]) && finite(q[1]))

/** Default items of the first (small octagon) map: replaced by the new defaults. */
const OLD_DEFAULTS = new Set([
  '6d3f6f0e-2c1a-4a8e-9b7e-3f1d2a5c7b01',
  '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c02',
  '1f2e3d4c-5b6a-4798-a1b2-c3d4e5f60703',
  '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c04',
  '3b4c5d6e-7f8a-4b9c-8d0e-2f3a4b5c6d05',
])

/** A saved row → an item (or null when it's broken). Points are kept on the map. */
export function itemFromRow(r: MapItemRow): MapItem | null {
  const kind = r.kind
  if (!isKind(kind)) return null
  const old = (r.v ?? 1) < MAP_VERSION
  if (old && OLD_DEFAULTS.has(r.uuid)) return null
  const dz = old ? OLD_SHIFT_Z : 0
  if (isBlock(kind)) {
    if (!finite(r.x) || !finite(r.z)) return null
    return clampBlock({ uuid: r.uuid, kind, x: r.x, z: r.z + dz, rot: finite(r.rot) ? ((Math.round(r.rot) % 4) + 4) % 4 : 0 })
  }
  if (!okPoints(r.points)) return null
  let points = r.points.map(([x, z]) => clampWorld(x, z + dz))
  if (points.length < minPoints(kind)) return null
  if (isRectZone(kind)) {
    points = rectCorners(points)
    if (points[1][0] - points[0][0] < MIN_RECT || points[2][1] - points[1][1] < MIN_RECT) return null
  }
  return { uuid: r.uuid, kind, points }
}

/** Defaults + saved rows (a saved row replaces its default; removed rows are hidden). */
export function itemsFrom(rows: MapItemRow[]): MapItem[] {
  const out = new Map(DEFAULT_ITEMS.map((i) => [i.uuid, i]))
  for (const r of rows) {
    if (r.removed) {
      out.delete(r.uuid)
      continue
    }
    const item = itemFromRow(r)
    if (item) out.set(item.uuid, item)
  }
  return [...out.values()]
}

const same = (a: MapItem, b: MapItem) => JSON.stringify(a) === JSON.stringify(b)

/** What changed between the saved items and the edited ones. */
export function diffItems(base: MapItem[], draft: MapItem[]) {
  const before = new Map(base.map((i) => [i.uuid, i]))
  const after = new Map(draft.map((i) => [i.uuid, i]))
  const added = draft.filter((i) => !before.has(i.uuid))
  const changed = draft.filter((i) => before.has(i.uuid) && !same(before.get(i.uuid)!, i))
  const removed = base.filter((i) => !after.has(i.uuid))
  return { added, changed, removed }
}

/** Activity-log wording for one item change. */
export function itemActivity(i: MapItem, how: 'added' | 'changed' | 'removed', before?: MapItem): string {
  if (i.kind === 'trees') {
    const n = i.points?.length ?? 0
    const was = before?.points?.length ?? 0
    if (how === 'added') return `Map · ${n} palm tree${n === 1 ? '' : 's'} planted`
    if (how === 'removed') return `Map · ${was || n} palm trees removed`
    return n > was ? `Map · ${n - was} palm tree${n - was === 1 ? '' : 's'} planted` : n < was ? `Map · ${was - n} palm tree${was - n === 1 ? '' : 's'} removed` : 'Map · palm trees moved'
  }
  const what = ITEM_LABEL[i.kind]
  if (how === 'added') return `Map · ${what} added`
  if (how === 'removed') return `Map · ${what} removed`
  return isBlock(i.kind) ? `Map · ${what} moved` : `Map · ${what} changed`
}

/**
 * A road as flat triangles in x / z (y is added by the renderer): one quad per
 * segment plus a round joint at every corner so bends look smooth.
 */
export function roadRibbon(points: XZ[], width: number, joinSides = 10): number[] {
  const out: number[] = []
  const h = width / 2
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i]
    const [bx, bz] = points[i + 1]
    const len = Math.hypot(bx - ax, bz - az)
    if (len < 1e-6) continue
    const nx = (-(bz - az) / len) * h
    const nz = ((bx - ax) / len) * h
    // two triangles, counter-clockwise when seen from above (+y)
    out.push(ax + nx, az + nz, bx - nx, bz - nz, bx + nx, bz + nz)
    out.push(ax + nx, az + nz, ax - nx, az - nz, bx - nx, bz - nz)
  }
  for (let i = 1; i < points.length - 1; i++) {
    const [cx, cz] = points[i]
    for (let k = 0; k < joinSides; k++) {
      const a0 = (k / joinSides) * Math.PI * 2
      const a1 = ((k + 1) / joinSides) * Math.PI * 2
      out.push(cx, cz, cx + Math.cos(a1) * h, cz + Math.sin(a1) * h, cx + Math.cos(a0) * h, cz + Math.sin(a0) * h)
    }
  }
  return out
}

/** Length of a line (tiles). */
export const lineLength = (pts: XZ[]) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0)

// ---------------------------------------------------------------------------
// Default items. North → south: the coastal highway runs past the octagon's
// land side and joins the spine road at both ends; the land half has a street
// grid (avenues down to the spine road, cross streets, the north gate road);
// then the port land with the harbour basin cut into it (open to the east),
// the wedge-shaped entrance pier at the basin mouth, and the floating city.
// ---------------------------------------------------------------------------

const id = (n: number) => `a7e3c1d0-5b2f-4c8e-9d1a-${n.toString(16).padStart(12, '0')}`

/** The spine road: edge to edge through the middle of the octagon, with a gentle curve. */
export const spineZ = (x: number) => (Math.abs(x) >= GRID ? -4 : -4 - 3 * (1 - (x / GRID) ** 2))
const half = (n: number) => Math.round(n * 2) / 2

const SPINE: XZ[] = [-114, -100, -80, -60, -40, -20, 0, 20, 40, 60, 80, 100, 114].map((x) => [x, half(spineZ(x))])

/** North end of an avenue: 3 tiles inside the octagon edge. */
const northEnd = (x: number) => -(Math.min(GRID, OCT - Math.abs(x)) - 3)
/** Half-width of a cross street: 3 tiles inside the octagon edge. */
const streetHalf = (z: number) => Math.min(GRID, OCT - Math.abs(z)) - 3

const avenue = (n: number, x: number): MapItem => ({ uuid: id(n), kind: 'road', points: [[x, northEnd(x)], [x, half(spineZ(x)) - 1.5]] })
const street = (n: number, z: number): MapItem => ({ uuid: id(n), kind: 'road', points: [[-streetHalf(z), z], [streetHalf(z), z]] })

const spinePalms: XZ[] = []
for (let x = -40; x <= 40; x += 5) for (const side of [-2.6, 2.6]) spinePalms.push(snapPoint(x, spineZ(x) + side, 0.25))

export const DEFAULT_ITEMS: MapItem[] = [
  {
    uuid: id(1),
    kind: 'highway',
    points: [
      [-WORLD, -4],
      [-114, -4],
      [-114, -40],
      [-40, -114],
      [40, -114],
      [114, -40],
      [114, -4],
      [WORLD, -4],
    ],
  },
  { uuid: id(2), kind: 'highway', points: SPINE },
  {
    uuid: id(3),
    kind: 'road',
    points: [
      [0, -114],
      [0, -78],
    ],
  },
  avenue(0x10, -75),
  avenue(0x11, -45),
  avenue(0x12, 45),
  avenue(0x13, 75),
  street(0x14, -50),
  street(0x15, -78),
  { uuid: id(0x20), kind: 'camp', x: -62, z: -30, rot: 0 },
  { uuid: id(0x21), kind: 'village', x: 75, z: -126, rot: 0 },
  { uuid: id(0x22), kind: 'trees', points: [...treeRow([-2.5, -101], [-2.5, -112], 2.5), ...treeRow([2.5, -101], [2.5, -112], 2.5)] },
  { uuid: id(0x23), kind: 'trees', points: spinePalms },
  {
    uuid: id(0x30),
    kind: 'industry',
    points: [
      [-98, -10],
      [-98, -40],
      [-40, -98],
      [40, -98],
      [98, -40],
      [98, -10],
    ],
  },
  {
    uuid: id(0x31),
    kind: 'port',
    points: [
      [-100, 0],
      [70, 0],
      [70, 32],
      [-100, 32],
    ],
  },
  {
    uuid: id(0x32),
    kind: 'basin',
    points: [
      [-50, 8],
      [70, 8],
      [70, 26],
      [-50, 26],
    ],
  },
  {
    uuid: id(0x33),
    kind: 'pier',
    points: [
      [70, 26],
      [99, 23],
      [70, 34],
    ],
  },
  {
    uuid: id(0x34),
    kind: 'city',
    points: [
      [-98, 37],
      [98, 37],
      [98, 40],
      [40, 98],
      [-40, 98],
      [-98, 40],
    ],
  },
]

/** The default zones only (for "Reset zones"). */
export const DEFAULT_ZONES = DEFAULT_ITEMS.filter((i) => isZone(i.kind))
