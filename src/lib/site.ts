import { itemStats, kpiForSubject, rollup, subjectKpis, type AllData } from './kpiData'
import { KPI_PARTS, STATUS_LABEL, kpiStatus, pct, type KpiResult, type KpiStatus } from './kpi'
import { kpiSubjects, type KpiSubject } from './subjects'
import { nameKey, sameCompany } from './names'
import { lastMonths } from './dashboard'
import { localDate, monthOf } from './dates'
import type { Contractor } from '../types'

// "Live site": the project as a construction site inside an octagon. Each
// contractor / work order has its own scope of works and a site office whose
// health bar is the month's overall KPI. Pure and deterministic — the 3D view
// and the layout editor are built on top of this.
//
// Grid: 1 tile = 1 world unit, x to the right, +z towards the camera / sea.
// The octagon is |x| ≤ 24, |z| ≤ 24, |x| + |z| ≤ 34; the coast is z = 10
// (land behind it, the harbour basin in front).

export const GRID = 24
export const OCT = 34
export const SHORE = 10

/** The 8 KPI items shown for a site (the quarterly audit is shown, never averaged). */
export const FLOORS = KPI_PARTS.filter((p) => p.key !== 'quarterly')

export type Scope = 'earthworks' | 'pipeline' | 'reservoir' | 'buildings' | 'culvert' | 'plant' | 'road' | 'bridge' | 'coastGuard' | 'port' | 'seawall'
export type Terrain = 'land' | 'coast'
export type Rot = 0 | 1 | 2 | 3

/** Where a site sits: the min corner of its (rotated) footprint, in tiles. */
export interface Place {
  gx: number
  gz: number
  rot: Rot
}

export interface OfficeDef {
  key: string
  /** Contractor names to look for (matched with sameCompany). */
  names: string[]
  /** Work order number; leading zeros don't matter. */
  wo?: string
  /** Office position in the site's own frame (centre = 0,0, unrotated). */
  at: [number, number]
}

export interface SiteDef {
  id: string
  /** Fixed id of the shared layout row for this site. */
  uuid: string
  scope: Scope
  /** Road works: asphalt paving or base course. */
  variant?: 'pave' | 'base'
  title: string
  /** Footprint in tiles (unrotated): w across x, d along z. */
  w: number
  d: number
  /** Coast sites straddle the shore, face the sea and only slide along it. */
  terrain: Terrain
  home: Place
  offices: OfficeDef[]
}

const site = (s: SiteDef) => s

/** The project's sites and their default layout (no overlaps, all inside the octagon). */
export const SITES: SiteDef[] = [
  site({
    id: 'earthworks', uuid: '3b119b50-5f5f-4110-814e-f6c8696ef837', scope: 'earthworks', title: 'Earthworks', w: 16, d: 9, terrain: 'land',
    home: { gx: -8, gz: -24, rot: 0 },
    offices: [{ key: 'earthworks', names: ['Al Fahad'], wo: '823', at: [6.4, 3.3] }],
  }),
  site({
    id: 'pipeline', uuid: 'ed4118ef-77b8-40aa-9163-77277a80bf18', scope: 'pipeline', title: 'Pipeline', w: 34, d: 3, terrain: 'land',
    home: { gx: -17, gz: -14, rot: 0 },
    offices: [{ key: 'pipeline', names: ['PPCO'], wo: '1322', at: [-16.1, 0] }],
  }),
  site({
    id: 'reservoir', uuid: '92b2420a-76df-454f-a1bd-29a2ee0c3f21', scope: 'reservoir', title: 'Water reservoir', w: 7, d: 8, terrain: 'land',
    home: { gx: -23, gz: -9, rot: 0 },
    offices: [{ key: 'reservoir', names: ['Shapoorji'], at: [2.3, 3.3] }],
  }),
  site({
    id: 'cluster', uuid: 'f27e7b17-5c2c-4ea3-baa7-5e879b3fe571', scope: 'buildings', title: 'Buildings', w: 10, d: 10, terrain: 'land',
    home: { gx: -14, gz: -10, rot: 0 },
    offices: [
      { key: 'cluster-sibs', names: ['SIBS'], at: [-3.4, 4.3] },
      { key: 'cluster-882', names: ['Al Fahad'], wo: '882', at: [3.4, 4.3] },
    ],
  }),
  site({
    id: 'culvert', uuid: '5da1ece9-5d14-4d44-9bac-90f78080ea08', scope: 'culvert', title: 'Excavation + culvert', w: 4, d: 10, terrain: 'land',
    home: { gx: -2, gz: -10, rot: 0 },
    offices: [{ key: 'culvert', names: ['Abyatona'], wo: '1112', at: [1.15, 4.2] }],
  }),
  site({
    id: 'plant', uuid: '63651e2e-db7b-4389-b0a5-39c3145acc7a', scope: 'plant', title: 'Process plant', w: 12, d: 10, terrain: 'land',
    home: { gx: 4, gz: -10, rot: 0 },
    offices: [{ key: 'plant', names: ['Thyssenkrupp'], at: [4.6, 4.2] }],
  }),
  site({
    id: 'roadWest', uuid: '21ea41f5-fc92-4fd2-bf65-58745552e36e', scope: 'road', variant: 'pave', title: 'Road works', w: 20, d: 3, terrain: 'land',
    home: { gx: -23, gz: 1, rot: 0 },
    offices: [{ key: 'roadWest', names: ['SAMA'], at: [-9.1, 0] }],
  }),
  site({
    id: 'bridge', uuid: '5115ec92-642e-437f-8c87-3d1f3c1f67fb', scope: 'bridge', title: 'Bridge', w: 6, d: 5, terrain: 'land',
    home: { gx: -3, gz: 0, rot: 0 },
    offices: [{ key: 'bridge', names: ['Abyatona'], wo: '1134', at: [2.25, 1.85] }],
  }),
  site({
    id: 'roadEast', uuid: '7cd38088-15ad-4430-b2d7-989368e62b79', scope: 'road', variant: 'base', title: 'Road works', w: 18, d: 3, terrain: 'land',
    home: { gx: 3, gz: 1, rot: 0 },
    offices: [{ key: 'roadEast', names: ['RPCO'], at: [8.1, 0] }],
  }),
  site({
    id: 'coastGuard', uuid: '1bd6bc09-12a6-4f4a-a14c-0bd1bfc7cc22', scope: 'coastGuard', title: 'Coast Guard building', w: 8, d: 8, terrain: 'coast',
    home: { gx: -20, gz: 6, rot: 0 },
    offices: [{ key: 'coastGuard', names: ['Al Fahad'], wo: '1272', at: [-3.0, -3.1] }],
  }),
  site({
    id: 'port', uuid: '269eb6df-fdec-47f8-a2a2-59a216276536', scope: 'port', title: 'Port', w: 16, d: 12, terrain: 'coast',
    home: { gx: -8, gz: 6, rot: 0 },
    offices: [{ key: 'port', names: ['ECH'], wo: '1131', at: [-6.8, -4.9] }],
  }),
  site({
    id: 'seawall', uuid: '473249b2-2bd3-4edc-b3c5-9cb62debf5cb', scope: 'seawall', title: 'Seawall + dredging', w: 9, d: 9, terrain: 'coast',
    home: { gx: 10, gz: 6, rot: 0 },
    offices: [{ key: 'seawall', names: ['Archirodon'], wo: '0876', at: [3.3, -3.4] }],
  }),
]

export const SITE_BY_ID = new Map(SITES.map((s) => [s.id, s]))
export const OFFICES = SITES.flatMap((s) => s.offices.map((o) => ({ site: s, office: o })))

// ---------------------------------------------------------------------------
// Offices ↔ KPI subjects
// ---------------------------------------------------------------------------

export const woKey = (n: string) => n.trim().replace(/^0+(?=\d)/, '')

export interface OfficeLink {
  key: string
  siteId: string
  contractor: Contractor
  /** Usually one; several when a contractor-level office covers more work orders. */
  subjects: KpiSubject[]
  /** The contractor is switched off in Contractors (shown, not in the site KPI). */
  off: boolean
  label: string
}

export interface SiteLinks {
  offices: Map<string, OfficeLink>
  /** Active KPI subjects with no office on the map. */
  unmapped: KpiSubject[]
  /** Office keys that matched nothing in the data. */
  missing: string[]
}

/** Best contractor for a list of names: exact name first, then active, then one with KPI rows. */
function findContractor(d: AllData, names: string[]): Contractor | undefined {
  const keys = new Set(names.map(nameKey))
  const spellings = (c: Contractor) => [c.name, ...(c.aliases ?? [])]
  const rows = new Set(d.kpis.map((k) => k.contractorUuid))
  const score = (c: Contractor) => (spellings(c).some((n) => keys.has(nameKey(n))) ? 4 : 0) + (c.active ? 2 : 0) + (rows.has(c.uuid) ? 1 : 0)
  return d.contractors
    .filter((c) => spellings(c).some((n) => names.some((m) => sameCompany(n, m))))
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))[0]
}

/** Which KPI subject each office shows. Computed once (not per month). */
export function linkOffices(d: AllData): SiteLinks {
  const active = kpiSubjects(d.contractors, d.workOrders)
  const claimed = new Set<string>()
  const offices = new Map<string, OfficeLink>()
  const missing: string[] = []
  const found = new Map(OFFICES.map(({ office }) => [office.key, findContractor(d, office.names)]))

  // Work-order offices first, so contractor-level offices only take what's left.
  for (const { site: s, office: o } of OFFICES) {
    if (!o.wo) continue
    const c = found.get(o.key)
    const subj = c && active.find((x) => x.contractor.uuid === c.uuid && !!x.workOrder && woKey(x.workOrder.number) === woKey(o.wo!))
    if (!c || !subj) {
      missing.push(o.key)
      continue
    }
    claimed.add(subj.key)
    offices.set(o.key, { key: o.key, siteId: s.id, contractor: c, subjects: [subj], off: false, label: subj.label })
  }
  for (const { site: s, office: o } of OFFICES) {
    if (o.wo) continue
    const c = found.get(o.key)
    if (!c) {
      missing.push(o.key)
      continue
    }
    const mine = active.filter((x) => x.contractor.uuid === c.uuid && !claimed.has(x.key))
    if (mine.length) {
      mine.forEach((x) => claimed.add(x.key))
      offices.set(o.key, { key: o.key, siteId: s.id, contractor: c, subjects: mine, off: false, label: mine.length === 1 ? mine[0].label : c.name })
      continue
    }
    // Switched off but still scored: the same subject kpiSubjects would make if it were on.
    if (!c.active && d.kpis.some((k) => k.contractorUuid === c.uuid)) {
      offices.set(o.key, { key: o.key, siteId: s.id, contractor: c, subjects: [{ key: c.uuid, contractor: c, label: c.name }], off: true, label: c.name })
      continue
    }
    missing.push(o.key)
  }
  return { offices, unmapped: active.filter((x) => !claimed.has(x.key)), missing }
}

// ---------------------------------------------------------------------------
// Health per month
// ---------------------------------------------------------------------------

export interface OfficeHealth {
  key: string
  overall: number | null
  status: KpiStatus
  /** Health bar fill, 0–1 (0 for no data). */
  fill: number
  /** The 8 items, in FLOORS order. */
  parts: (number | null)[]
}

export interface SiteMonth {
  month: string
  offices: Map<string, OfficeHealth>
  /** Same number as the 2D Dashboard's overall KPI. */
  overall: number | null
  status: KpiStatus
  /** Offices on the map (switched-off ones left out). */
  counts: Record<KpiStatus, number>
  unmapped: { subject: KpiSubject; overall: number | null; status: KpiStatus }[]
}

export function healthOf(key: string, r: KpiResult): OfficeHealth {
  const overall = r.overall
  return {
    key,
    overall,
    status: kpiStatus(overall),
    fill: overall === null ? 0 : Math.max(0, Math.min(1, overall / 100)),
    parts: FLOORS.map((p) => r[p.key]),
  }
}

export function siteMonth(d: AllData, links: SiteLinks, month: string): SiteMonth {
  const rows = subjectKpis(d, month)
  const byKey = new Map(rows.map((r) => [r.subject.key, r.result]))
  const offices = new Map<string, OfficeHealth>()
  const counts: Record<KpiStatus, number> = { good: 0, warn: 0, bad: 0, none: 0 }
  for (const l of links.offices.values()) {
    const results = l.subjects.map((s) => byKey.get(s.key) ?? kpiForSubject(d, s, month))
    const h = healthOf(l.key, results.length === 1 ? results[0] : rollup(results))
    offices.set(l.key, h)
    if (!l.off) counts[h.status]++
  }
  const all = itemStats(rows, 'overall')
  const unmapped = links.unmapped.map((s) => {
    const overall = byKey.get(s.key)?.overall ?? null
    return { subject: s, overall, status: kpiStatus(overall) }
  })
  return { month, offices, overall: all.avg, status: kpiStatus(all.avg), counts, unmapped }
}

/** Months for the time bar: the last 12, without leading months that have no KPI rows at all. */
export function siteMonths(d: AllData, today: string = localDate(), n = 12): string[] {
  const all = lastMonths(monthOf(today), n)
  const first = all.findIndex((m) => d.kpis.some((k) => k.month === m))
  return first > 0 ? all.slice(first) : all
}

export interface TourStop {
  /** Office to fly to; none = the overview. */
  officeKey?: string
  tone: 'bad' | 'warn' | 'good'
  text: string
}

/** Critical first, then at risk, worst first; ends on the whole site. */
export function buildTour(links: SiteLinks, m: SiteMonth): TourStop[] {
  const stops: TourStop[] = []
  const list = [...links.offices.values()]
    .filter((l) => !l.off)
    .map((l) => ({ l, h: m.offices.get(l.key)! }))
    .filter(({ h }) => h && (h.status === 'bad' || h.status === 'warn'))
    .sort((a, b) => (a.h.overall ?? 0) - (b.h.overall ?? 0) || a.l.label.localeCompare(b.l.label))
  for (const { l, h } of list) {
    stops.push({ officeKey: l.key, tone: h.status === 'bad' ? 'bad' : 'warn', text: `${l.label}: KPI ${pct(h.overall)} · ${STATUS_LABEL[h.status]}` })
  }
  stops.push({ tone: m.status === 'bad' ? 'bad' : m.status === 'warn' ? 'warn' : 'good', text: `Whole site: KPI ${pct(m.overall)}` })
  return stops
}

// ---------------------------------------------------------------------------
// Layout geometry (the editor)
// ---------------------------------------------------------------------------

export type Layout = Record<string, Place>

export interface Rect {
  x0: number
  z0: number
  x1: number
  z1: number
}

export const sizeOf = (def: SiteDef, rot: Rot) => (rot % 2 ? { w: def.d, d: def.w } : { w: def.w, d: def.d })

export function footprint(def: SiteDef, p: Place): Rect {
  const s = sizeOf(def, p.rot)
  return { x0: p.gx, z0: p.gz, x1: p.gx + s.w, z1: p.gz + s.d }
}

export const insideOctagon = (x: number, z: number) => Math.abs(x) <= GRID && Math.abs(z) <= GRID && Math.abs(x) + Math.abs(z) <= OCT

export const canRotate = (def: SiteDef) => def.terrain === 'land'

/** Turn 90° about the footprint's centre (rounded to a tile). Coast sites keep facing the sea. */
export function rotatePlace(def: SiteDef, p: Place): Place {
  if (!canRotate(def)) return p
  const a = sizeOf(def, p.rot)
  const rot = ((p.rot + 1) % 4) as Rot
  const b = sizeOf(def, rot)
  return { gx: Math.round(p.gx + a.w / 2 - b.w / 2), gz: Math.round(p.gz + a.d / 2 - b.d / 2), rot }
}

/** Snap a drag: the ground point under the finger minus where the site was grabbed. Coast sites slide along the shore. */
export function snapPlace(def: SiteDef, p: Place, hitX: number, hitZ: number, grab: { ox: number; oz: number }): Place {
  return {
    gx: Math.round(hitX - grab.ox),
    gz: def.terrain === 'coast' ? def.home.gz : Math.round(hitZ - grab.oz),
    rot: p.rot,
  }
}

export type FitReason = 'ok' | 'outside' | 'overlap' | 'shore'

export interface Fit {
  ok: boolean
  reason: FitReason
  /** The site it overlaps. */
  other?: string
}

const overlaps = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1

export function fitCheck(layout: Layout, id: string): Fit {
  const def = SITE_BY_ID.get(id)
  const p = layout[id]
  if (!def || !p) return { ok: false, reason: 'outside' }
  const r = footprint(def, p)
  const corners: [number, number][] = [
    [r.x0, r.z0],
    [r.x1, r.z0],
    [r.x0, r.z1],
    [r.x1, r.z1],
  ]
  if (!corners.every(([x, z]) => insideOctagon(x, z))) return { ok: false, reason: 'outside' }
  if (def.terrain === 'land' ? r.z1 > SHORE : !(r.z0 < SHORE && r.z1 > SHORE)) return { ok: false, reason: 'shore' }
  for (const other of SITES) {
    if (other.id === id || !layout[other.id]) continue
    if (overlaps(r, footprint(other, layout[other.id]))) return { ok: false, reason: 'overlap', other: other.id }
  }
  return { ok: true, reason: 'ok' }
}

export function fitHint(f: Fit, def: SiteDef): string {
  if (f.reason === 'outside') return 'Outside the site'
  if (f.reason === 'shore') return def.terrain === 'land' ? 'Must stay on land' : 'Must stay on the shore'
  if (f.reason === 'overlap') return `Overlaps ${SITE_BY_ID.get(f.other ?? '')?.title ?? 'another site'}`
  return 'Fits'
}

export const homeLayout = (): Layout => Object.fromEntries(SITES.map((s) => [s.id, { ...s.home }]))

const isRot = (n: unknown): n is Rot => n === 0 || n === 1 || n === 2 || n === 3
const isTile = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && Math.abs(n) <= GRID

/** The layout from saved rows: unknown sites and broken rows are ignored; missing sites stay at home. */
export function layoutFrom(rows: { siteId: string; gx: number; gz: number; rot: number }[]): Layout {
  const out = homeLayout()
  for (const r of rows) {
    const def = SITE_BY_ID.get(r.siteId)
    if (!def || !isTile(r.gx) || !isTile(r.gz) || !isRot(r.rot)) continue
    out[def.id] = def.terrain === 'coast' ? { gx: r.gx, gz: def.home.gz, rot: 0 } : { gx: r.gx, gz: r.gz, rot: r.rot }
  }
  return out
}

export const samePlace = (a: Place, b: Place) => a.gx === b.gx && a.gz === b.gz && a.rot === b.rot

/** Local (unrotated, centred) → world offset for a rotation. Matches rotation.y = -rot·π/2. */
export function turnXZ(x: number, z: number, rot: Rot): [number, number] {
  switch (rot) {
    case 1:
      return [-z, x]
    case 2:
      return [-x, -z]
    case 3:
      return [z, -x]
    default:
      return [x, z]
  }
}

/** World centre and y-rotation of a placed site. */
export function toWorld(def: SiteDef, p: Place): { x: number; z: number; ry: number } {
  const s = sizeOf(def, p.rot)
  return { x: p.gx + s.w / 2, z: p.gz + s.d / 2, ry: (-p.rot * Math.PI) / 2 }
}

/** World position of an office. */
export function officeWorld(def: SiteDef, p: Place, o: OfficeDef): { x: number; z: number } {
  const c = toWorld(def, p)
  const [dx, dz] = turnXZ(o.at[0], o.at[1], p.rot)
  return { x: c.x + dx, z: c.z + dz }
}
