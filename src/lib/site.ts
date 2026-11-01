import { itemStats, kpiForSubject, rollup, subjectKpis, type AllData } from './kpiData'
import { KPI_PARTS, STATUS_LABEL, kpiStatus, pct, type KpiResult, type KpiStatus } from './kpi'
import { kpiSubjects, type KpiSubject } from './subjects'
import { nameKey, sameCompany } from './names'
import { lastMonths } from './dashboard'
import { localDate, monthOf } from './dates'
import { woOf } from './subjects'
import { QUAY, WORLD, insideWorld, rectsOverlap, type Rect } from './world'
import { DEFAULT_ZONE_SET, isWater, onLand, quayOf, type Zones } from './zones'
import type { Contractor, Manpower } from '../types'

// "Live site": the project as a construction site in a city-scale octagon.
// Each contractor / work order has its own barricaded site with its scope of
// works and a site office whose health bar is the month's overall KPI; its
// worker figures stand for the month's manpower. Pure and deterministic — the
// 3D view and the layout editor are built on top of this.
//
// World and zones: see world.ts (the octagon, north = land, south = sea) and
// zones.ts (industrial zone, port land, harbour basin, pier, floating city).
// Land sites sit on land (the mainland, the port land or the pier); coast
// sites sit on the basin's north quay, half on the quay and half over the
// water, and follow the quay when the basin is moved.

export { COAST, GRID, OCT, OCTAGON, OCTAGON_LAND, QUAY, WORLD, insideOctagon, insideWorld } from './world'
export type { Rect } from './world'

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
  /** Coast sites straddle the basin's north quay, face the water and only slide along it. */
  terrain: Terrain
  home: Place
  offices: OfficeDef[]
}

const site = (s: SiteDef) => s

/** The project's sites and their default layout: land sites just north of the spine road, coast sites on the basin quay. */
export const SITES: SiteDef[] = [
  site({
    id: 'earthworks', uuid: '3b119b50-5f5f-4110-814e-f6c8696ef837', scope: 'earthworks', title: 'Earthworks', w: 16, d: 9, terrain: 'land',
    home: { gx: -8, gz: -45, rot: 0 },
    offices: [{ key: 'earthworks', names: ['Al Fahad'], wo: '823', at: [6.4, 3.3] }],
  }),
  site({
    id: 'pipeline', uuid: 'ed4118ef-77b8-40aa-9163-77277a80bf18', scope: 'pipeline', title: 'Pipeline', w: 34, d: 3, terrain: 'land',
    home: { gx: -17, gz: -34, rot: 0 },
    offices: [{ key: 'pipeline', names: ['PPCO'], wo: '1322', at: [-16.1, 0] }],
  }),
  site({
    id: 'reservoir', uuid: '92b2420a-76df-454f-a1bd-29a2ee0c3f21', scope: 'reservoir', title: 'Water reservoir', w: 7, d: 8, terrain: 'land',
    home: { gx: -30, gz: -26, rot: 0 },
    offices: [{ key: 'reservoir', names: ['Shapoorji'], at: [2.3, 3.3] }],
  }),
  site({
    id: 'cluster', uuid: 'f27e7b17-5c2c-4ea3-baa7-5e879b3fe571', scope: 'buildings', title: 'Buildings', w: 10, d: 10, terrain: 'land',
    home: { gx: -19, gz: -26, rot: 0 },
    offices: [
      { key: 'cluster-sibs', names: ['SIBS'], at: [-3.4, 4.3] },
      { key: 'cluster-882', names: ['Al Fahad'], wo: '882', at: [3.4, 4.3] },
    ],
  }),
  site({
    id: 'culvert', uuid: '5da1ece9-5d14-4d44-9bac-90f78080ea08', scope: 'culvert', title: 'Excavation + culvert', w: 4, d: 10, terrain: 'land',
    home: { gx: -2, gz: -26, rot: 0 },
    offices: [{ key: 'culvert', names: ['Abyatona'], wo: '1112', at: [1.15, 4.2] }],
  }),
  site({
    id: 'plant', uuid: '63651e2e-db7b-4389-b0a5-39c3145acc7a', scope: 'plant', title: 'Process plant', w: 12, d: 10, terrain: 'land',
    home: { gx: 7, gz: -26, rot: 0 },
    offices: [{ key: 'plant', names: ['Thyssenkrupp'], at: [4.6, 4.2] }],
  }),
  site({
    id: 'roadWest', uuid: '21ea41f5-fc92-4fd2-bf65-58745552e36e', scope: 'road', variant: 'pave', title: 'Road works', w: 20, d: 3, terrain: 'land',
    home: { gx: -23, gz: -15, rot: 0 },
    offices: [{ key: 'roadWest', names: ['SAMA'], at: [-9.1, 0] }],
  }),
  site({
    id: 'bridge', uuid: '5115ec92-642e-437f-8c87-3d1f3c1f67fb', scope: 'bridge', title: 'Bridge', w: 6, d: 5, terrain: 'land',
    home: { gx: -3, gz: -16, rot: 0 },
    offices: [{ key: 'bridge', names: ['Abyatona'], wo: '1134', at: [2.25, 1.85] }],
  }),
  site({
    id: 'roadEast', uuid: '7cd38088-15ad-4430-b2d7-989368e62b79', scope: 'road', variant: 'base', title: 'Road works', w: 18, d: 3, terrain: 'land',
    home: { gx: 3, gz: -15, rot: 0 },
    offices: [{ key: 'roadEast', names: ['RPCO'], at: [8.1, 0] }],
  }),
  site({
    id: 'coastGuard', uuid: '1bd6bc09-12a6-4f4a-a14c-0bd1bfc7cc22', scope: 'coastGuard', title: 'Coast Guard building', w: 8, d: 8, terrain: 'coast',
    home: { gx: -24, gz: 4, rot: 0 },
    offices: [{ key: 'coastGuard', names: ['Al Fahad'], wo: '1272', at: [-3.0, -3.1] }],
  }),
  site({
    id: 'port', uuid: '269eb6df-fdec-47f8-a2a2-59a216276536', scope: 'port', title: 'Port', w: 16, d: 12, terrain: 'coast',
    home: { gx: -8, gz: 4, rot: 0 },
    offices: [{ key: 'port', names: ['ECH'], wo: '1131', at: [-6.8, -4.9] }],
  }),
  site({
    id: 'seawall', uuid: '473249b2-2bd3-4edc-b3c5-9cb62debf5cb', scope: 'seawall', title: 'Seawall + dredging', w: 9, d: 9, terrain: 'coast',
    home: { gx: 14, gz: 4, rot: 0 },
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
  /** Manpower per office (latest count up to this month); offices without a count are left out. */
  crews: Map<string, Crew>
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
  return { month, offices, overall: all.avg, status: kpiStatus(all.avg), counts, unmapped, crews: officeCrews(d.manpower, links, month) }
}

// ---------------------------------------------------------------------------
// Manpower: the worker figures on each site stand for its manpower count
// ---------------------------------------------------------------------------

export interface Crew {
  workers: number
  /** Month of the count (the latest one up to the shown month). */
  month: string
}

/** Each office's manpower: per KPI subject the latest count up to `month`, added up. */
export function officeCrews(rows: Manpower[], links: SiteLinks, month: string): Map<string, Crew> {
  const latest = new Map<string, Manpower>()
  for (const m of rows) {
    if (m.month > month || !(m.totalWorkers > 0)) continue
    const k = `${m.contractorUuid}|${m.workOrderUuid || ''}`
    const had = latest.get(k)
    if (!had || m.month > had.month) latest.set(k, m)
  }
  const out = new Map<string, Crew>()
  for (const l of links.offices.values()) {
    let workers = 0
    let at = ''
    for (const s of l.subjects) {
      const m = latest.get(`${s.contractor.uuid}|${woOf(s)}`)
      if (!m) continue
      workers += m.totalWorkers
      if (m.month > at) at = m.month
    }
    if (workers > 0) out.set(l.key, { workers, month: at })
  }
  return out
}

/** People per worker figure: the smallest round number that keeps the figures under `cap`. */
export const CREW_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000]
export function crewScale(total: number, cap: number): number {
  return CREW_STEPS.find((s) => total / s <= cap) ?? CREW_STEPS[CREW_STEPS.length - 1]
}

/** Figures for a head count: at least one for any crew, none without one. */
export const figuresFor = (workers: number, perFigure: number) => (workers > 0 ? Math.max(1, Math.round(workers / perFigure)) : 0)

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

export const sizeOf = (def: SiteDef, rot: Rot) => (rot % 2 ? { w: def.d, d: def.w } : { w: def.w, d: def.d })

export function footprint(def: SiteDef, p: Place): Rect {
  const s = sizeOf(def, p.rot)
  return { x0: p.gx, z0: p.gz, x1: p.gx + s.w, z1: p.gz + s.d }
}

export const canRotate = (def: SiteDef) => def.terrain === 'land'

/** Turn 90° about the footprint's centre (rounded to a tile). Coast sites keep facing the water. */
export function rotatePlace(def: SiteDef, p: Place): Place {
  if (!canRotate(def)) return p
  const a = sizeOf(def, p.rot)
  const rot = ((p.rot + 1) % 4) as Rot
  const b = sizeOf(def, rot)
  return { gx: Math.round(p.gx + a.w / 2 - b.w / 2), gz: Math.round(p.gz + a.d / 2 - b.d / 2), rot }
}

/** Snap a drag: the ground point under the finger minus where the site was grabbed. Coast sites slide along the quay. */
export function snapPlace(def: SiteDef, p: Place, hitX: number, hitZ: number, grab: { ox: number; oz: number }): Place {
  return {
    gx: Math.round(hitX - grab.ox),
    gz: def.terrain === 'coast' ? def.home.gz : Math.round(hitZ - grab.oz),
    rot: p.rot,
  }
}

/** How far the basin's quay is from its default line (coast sites move with it). */
export const quayShift = (zones: Zones) => (quayOf(zones)?.z ?? QUAY) - QUAY

/** Put the coast sites on the basin's quay (saved rows keep the default quay line). */
export function alignCoast(layout: Layout, zones: Zones): Layout {
  const dz = quayShift(zones)
  if (!dz) return layout
  const out = { ...layout }
  for (const s of SITES) if (s.terrain === 'coast' && out[s.id]) out[s.id] = { ...out[s.id], gz: s.home.gz + dz }
  return out
}

/** World z of a coast site's shore line (its quay edge). */
export const shoreOf = (def: SiteDef, p: Place) => p.gz + (QUAY - def.home.gz)

export type FitReason = 'ok' | 'outside' | 'overlap' | 'shore'

export interface Fit {
  ok: boolean
  reason: FitReason
  /** The site it overlaps. */
  other?: string
}

/** Points over a rectangle, a little in from its edges, at most `step` apart. */
function samples(x0: number, z0: number, x1: number, z1: number, step = 2): [number, number][] {
  const e = 0.25
  const nx = Math.max(1, Math.ceil((x1 - x0 - 2 * e) / step))
  const nz = Math.max(1, Math.ceil((z1 - z0 - 2 * e) / step))
  const out: [number, number][] = []
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) out.push([x0 + e + ((x1 - x0 - 2 * e) * i) / nx, z0 + e + ((z1 - z0 - 2 * e) * j) / nz])
  return out
}

/** Does a site fit where it is? (Pass the coast-aligned layout.) */
export function fitCheck(layout: Layout, id: string, zones: Zones = DEFAULT_ZONE_SET): Fit {
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
  if (!corners.every(([x, z]) => insideWorld(x, z))) return { ok: false, reason: 'outside' }
  if (def.terrain === 'land') {
    if (!samples(r.x0, r.z0, r.x1, r.z1).every(([x, z]) => onLand(zones, x, z))) return { ok: false, reason: 'shore' }
  } else {
    // half on the quay, half over the basin's water
    const shore = shoreOf(def, p)
    const land = samples(r.x0, r.z0, r.x1, shore).every(([x, z]) => onLand(zones, x, z))
    const water = samples(r.x0, shore, r.x1, r.z1).every(([x, z]) => isWater(zones, x, z))
    if (!land || !water) return { ok: false, reason: 'shore' }
  }
  for (const other of SITES) {
    if (other.id === id || !layout[other.id]) continue
    if (rectsOverlap(r, footprint(other, layout[other.id]))) return { ok: false, reason: 'overlap', other: other.id }
  }
  return { ok: true, reason: 'ok' }
}

export function fitHint(f: Fit, def: SiteDef): string {
  if (f.reason === 'outside') return 'Too far out'
  if (f.reason === 'shore') return def.terrain === 'land' ? 'Must stay on land' : 'Must stay on the basin quay'
  if (f.reason === 'overlap') return `Overlaps ${SITE_BY_ID.get(f.other ?? '')?.title ?? 'another site'}`
  return 'Fits'
}

/** Only Admins arrange the map (sites, roads, trees, camps, zones). */
export const canEditLayout = (role: string) => role === 'admin'

export const homeLayout = (): Layout => Object.fromEntries(SITES.map((s) => [s.id, { ...s.home }]))

const isRot = (n: unknown): n is Rot => n === 0 || n === 1 || n === 2 || n === 3
const isTile = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && Math.abs(n) <= WORLD

/** Layout format: 3 = the city-scale octagon, 2 = the bigger octagon, no `v` = the first version. */
export const LAYOUT_VERSION = 3

/** Default places of the older formats, to carry over moves saved with them. */
const OLD_HOME: Record<1 | 2, Record<string, [number, number]>> = {
  1: {
    earthworks: [-8, -24],
    pipeline: [-17, -14],
    reservoir: [-23, -9],
    cluster: [-14, -10],
    culvert: [-2, -10],
    plant: [4, -10],
    roadWest: [-23, 1],
    bridge: [-3, 0],
    roadEast: [3, 1],
    coastGuard: [-20, 6],
    port: [-8, 6],
    seawall: [10, 6],
  },
  2: {
    earthworks: [-8, -39],
    pipeline: [-17, -28],
    reservoir: [-30, -20],
    cluster: [-19, -20],
    culvert: [-2, -20],
    plant: [7, -20],
    roadWest: [-23, -9],
    bridge: [-3, -10],
    roadEast: [3, -9],
    coastGuard: [-24, -4],
    port: [-8, -4],
    seawall: [14, -4],
  },
}

/** The layout from saved rows: unknown sites and broken rows are ignored; missing sites stay at home. */
export function layoutFrom(rows: { siteId: string; gx: number; gz: number; rot: number; v?: number }[]): Layout {
  const out = homeLayout()
  for (const r of rows) {
    const def = SITE_BY_ID.get(r.siteId)
    if (!def || !isTile(r.gx) || !isTile(r.gz) || !isRot(r.rot)) continue
    let gx = r.gx
    let gz = r.gz
    const v = r.v ?? 1
    if (v < LAYOUT_VERSION) {
      // keep the move relative to the old default place
      const old = OLD_HOME[v === 1 ? 1 : 2][def.id]
      if (!old) continue
      gx = def.home.gx + (r.gx - old[0])
      gz = def.home.gz + (r.gz - old[1])
    }
    out[def.id] = def.terrain === 'coast' ? { gx, gz: def.home.gz, rot: 0 } : { gx, gz, rot: r.rot }
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
