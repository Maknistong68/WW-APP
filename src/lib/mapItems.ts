import { SHORE, WORLD } from './site'

// Things the Admin adds to the "Live site" map: small roads and highways
// (drawn as lines), palm trees (single or in rows), workers' camps and
// villages (blocks). Shared with the team like the site layout; default items
// (the highway outside the octagon, the access road, a camp and a village)
// have fixed ids so they can be moved or removed too. Pure helpers only.

export type ItemKind = 'road' | 'highway' | 'trees' | 'camp' | 'village'
export type XZ = [number, number]

export interface MapItem {
  uuid: string
  kind: ItemKind
  /** Roads / highways: the line; trees: one point per palm. */
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
}

export const ROAD_WIDTH = { road: 1.1, highway: 2.8 } as const
/** Block footprint (w along x, d along z) before turning. */
export const BLOCK_SIZE = { camp: [11, 7], village: [9, 9] } as const

export const ITEM_LABEL: Record<ItemKind, string> = { road: 'road', highway: 'highway', trees: 'palm trees', camp: 'workers’ camp', village: 'village' }

const isLine = (k: ItemKind) => k === 'road' || k === 'highway'
const isBlock = (k: ItemKind): k is 'camp' | 'village' => k === 'camp' || k === 'village'

/** Keep a point on the buildable land (not in the sea, not off the map). */
export function clampLand(x: number, z: number): XZ {
  return [Math.max(-WORLD, Math.min(WORLD, x)), Math.max(-WORLD, Math.min(SHORE - 0.6, z))]
}

/** Snap to half tiles and keep it on land. */
export function snapPoint(x: number, z: number, step = 0.5): XZ {
  const [cx, cz] = clampLand(x, z)
  return [Math.round(cx / step) * step, Math.round(cz / step) * step]
}

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

/** Keep a block's whole footprint on land. */
function clampBlock(item: MapItem): MapItem {
  const [w, d] = blockSize(item)
  const x = Math.max(-WORLD + w / 2, Math.min(WORLD - w / 2, item.x ?? 0))
  const z = Math.max(-WORLD + d / 2, Math.min(SHORE - 0.6 - d / 2, item.z ?? 0))
  return { ...item, x: Math.round(x * 2) / 2, z: Math.round(z * 2) / 2 }
}

/** Move a whole item (blocks and lines stay on land). */
export function moveItem(item: MapItem, dx: number, dz: number): MapItem {
  if (isBlock(item.kind)) return clampBlock({ ...item, x: (item.x ?? 0) + dx, z: (item.z ?? 0) + dz })
  const pts = item.points ?? []
  // shift as one piece, but never past the shore or the edge of the map
  let ddx = dx
  let ddz = dz
  for (const [x, z] of pts) {
    const [cx, cz] = clampLand(x + ddx, z + ddz)
    ddx = cx - x
    ddz = cz - z
  }
  return { ...item, points: pts.map(([x, z]) => snapPoint(x + ddx, z + ddz, isLine(item.kind) ? 0.5 : 0.25)) }
}

/** Move one point of a line or one palm. */
export function movePoint(item: MapItem, index: number, x: number, z: number): MapItem {
  const pts = [...(item.points ?? [])]
  if (index < 0 || index >= pts.length) return item
  pts[index] = snapPoint(x, z, isLine(item.kind) ? 0.5 : 0.25)
  return { ...item, points: pts }
}

/** Remove one point (a palm, or a road corner). Returns null when nothing is left. */
export function removePoint(item: MapItem, index: number): MapItem | null {
  const pts = (item.points ?? []).filter((_, i) => i !== index)
  if (pts.length === 0 || (isLine(item.kind) && pts.length < 2)) return null
  return { ...item, points: pts }
}

export function rotateItem(item: MapItem): MapItem {
  if (!isBlock(item.kind)) return item
  return clampBlock({ ...item, rot: ((item.rot ?? 0) + 1) % 4 })
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const okPoints = (p: unknown): p is XZ[] => Array.isArray(p) && p.every((q) => Array.isArray(q) && q.length === 2 && finite(q[0]) && finite(q[1]))

/** A saved row → an item (or null when it's broken). Points are kept on land. */
export function itemFromRow(r: MapItemRow): MapItem | null {
  const kind = r.kind
  if (kind !== 'road' && kind !== 'highway' && kind !== 'trees' && kind !== 'camp' && kind !== 'village') return null
  const raw = r.points
  if (isBlock(kind)) {
    if (!finite(r.x) || !finite(r.z)) return null
    return clampBlock({ uuid: r.uuid, kind, x: r.x, z: r.z, rot: finite(r.rot) ? ((Math.round(r.rot) % 4) + 4) % 4 : 0 })
  }
  if (!okPoints(raw)) return null
  const points = raw.map(([x, z]) => clampLand(x, z))
  if (points.length === 0 || (isLine(kind) && points.length < 2)) return null
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
  return isLine(i.kind) ? `Map · ${what} changed` : `Map · ${what} moved`
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
// Default items: the highway outside the octagon's land side (as in the plan
// photos), the access road from the site gate, a workers' camp and a village.
// ---------------------------------------------------------------------------
export const DEFAULT_ITEMS: MapItem[] = [
  {
    uuid: '6d3f6f0e-2c1a-4a8e-9b7e-3f1d2a5c7b01',
    kind: 'highway',
    points: [
      [-96, -5],
      [-52, -5],
      [-47, -19],
      [-20, -47],
      [20, -47],
      [47, -19],
      [52, -5],
      [96, -5],
    ],
  },
  {
    uuid: '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c02',
    kind: 'road',
    points: [
      [0, -40],
      [0, -47],
      [0, -72],
    ],
  },
  { uuid: '1f2e3d4c-5b6a-4798-a1b2-c3d4e5f60703', kind: 'camp', x: -30, z: -62, rot: 0 },
  { uuid: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c04', kind: 'village', x: 26, z: -64, rot: 0 },
  {
    uuid: '3b4c5d6e-7f8a-4b9c-8d0e-2f3a4b5c6d05',
    kind: 'trees',
    points: [...treeRow([-2.2, -50], [-2.2, -70], 2.5), ...treeRow([2.2, -50], [2.2, -70], 2.5)],
  },
]
