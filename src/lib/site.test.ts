import { describe, expect, it } from 'vitest'
import {
  OFFICES,
  SITES,
  SITE_BY_ID,
  buildTour,
  fitCheck,
  footprint,
  healthOf,
  homeLayout,
  insideOctagon,
  canEditLayout,
  alignCoast,
  crewScale,
  figuresFor,
  layoutFrom,
  officeCrews,
  linkOffices,
  officeWorld,
  rotatePlace,
  siteMonth,
  siteMonths,
  snapPlace,
  woKey,
  type Layout,
  type Rect,
  type Rot,
} from './site'
import { itemStats, subjectKpis, type AllData } from './kpiData'
import { emptyKpi } from './subjects'
import type { KpiResult } from './kpi'
import { DEFAULT_ITEMS } from './mapItems'
import { zonesOf } from './zones'
import type { Contractor, KpiMonth, Manpower, WorkOrder } from '../types'

const c = (uuid: string, name: string, active = true, aliases: string[] = []) => ({ uuid, name, active, aliases }) as unknown as Contractor
const wo = (uuid: string, contractorUuid: string, number: string, active = true) => ({ uuid, contractorUuid, number, label: '', active }) as unknown as WorkOrder

// The real contractor list (names only), including look-alikes that must not match.
const contractors = [
  c('aby', 'Abyatona'),
  c('fah', 'Al Fahad', true, ['Alfahd Trading Industry & Contracting Co']),
  c('arc', 'Archirodon'),
  c('ech', 'ECH'),
  c('ppc', 'PPCO'),
  c('rpc', 'RPCO'),
  c('sam', 'SAMA'),
  c('sha', 'Shapoorji'),
  c('spg', 'Shapoorji Pallonji Group', false),
  c('sib', 'SIBS', false),
  c('sibl', 'Specialist Independent Building Services', false),
  c('thy', 'Thyssenkrupp'),
  c('tpd', 'TPD'),
  c('tdp', 'TDP', false),
]
const workOrders = [
  wo('w1112', 'aby', '1112'),
  wo('w1134', 'aby', '1134'),
  wo('w1272', 'fah', '1272'),
  wo('w823', 'fah', '823'),
  wo('w882', 'fah', '882'),
  wo('w876', 'arc', '876'), // stored without the leading zero
  wo('w1131', 'ech', '1131'),
  wo('w1322', 'ppc', '1322'),
  wo('w892', 'tpd', '892'),
]

const kpi = (contractorUuid: string, workOrderUuid: string, month: string, accommodationPct: number | null, allDocs = true): KpiMonth => ({
  ...emptyKpi(contractorUuid, workOrderUuid, month),
  wps: allDocs,
  manpowerDecl: allDocs,
  salaryDecl: allDocs,
  accommodationPct,
})

const data = (kpis: KpiMonth[] = []): AllData => ({
  loaded: true,
  contractors,
  byUuid: new Map(contractors.map((x) => [x.uuid, x])),
  workOrders,
  woByUuid: new Map(workOrders.map((w) => [w.uuid, w])),
  camps: [],
  tickets: [],
  kpis,
  manpower: [],
  weekly: [],
  inspections: [],
})

const touches = (a: Rect, b: Rect) => {
  const xTouch = a.x1 === b.x0 || b.x1 === a.x0
  const zTouch = a.z1 === b.z0 || b.z1 === a.z0
  const xOverlap = a.x0 < b.x1 && b.x0 < a.x1
  const zOverlap = a.z0 < b.z1 && b.z0 < a.z1
  return (xTouch && zOverlap) || (zTouch && xOverlap)
}

describe('Live site: catalog', () => {
  it('12 sites, 13 offices, unique ids and fixed v4 uuids', () => {
    expect(SITES).toHaveLength(12)
    expect(OFFICES).toHaveLength(13)
    expect(new Set(SITES.map((s) => s.id)).size).toBe(12)
    expect(new Set(SITES.map((s) => s.uuid)).size).toBe(12)
    expect(new Set(OFFICES.map((o) => o.office.key)).size).toBe(13)
    for (const s of SITES) expect(s.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('the default layout fits: inside the octagon, no overlaps, land on land, coast on the shore', () => {
    const home = homeLayout()
    for (const s of SITES) expect([s.id, fitCheck(home, s.id)]).toEqual([s.id, { ok: true, reason: 'ok' }])
  })

  it('pipeline is the longest feature; the bridge joins the culvert and both roads', () => {
    const longest = [...SITES].sort((a, b) => Math.max(b.w, b.d) - Math.max(a.w, a.d))[0]
    expect(longest.id).toBe('pipeline')
    const fp = (id: string) => footprint(SITE_BY_ID.get(id)!, SITE_BY_ID.get(id)!.home)
    expect(touches(fp('bridge'), fp('culvert'))).toBe(true)
    expect(touches(fp('bridge'), fp('roadWest'))).toBe(true)
    expect(touches(fp('bridge'), fp('roadEast'))).toBe(true)
  })

  it('every office stays inside its footprint in all four turns', () => {
    for (const { site: s, office: o } of OFFICES) {
      for (const rot of [0, 1, 2, 3] as Rot[]) {
        const p = { ...s.home, rot }
        const r = footprint(s, p)
        const w = officeWorld(s, p, o)
        expect(w.x).toBeGreaterThan(r.x0)
        expect(w.x).toBeLessThan(r.x1)
        expect(w.z).toBeGreaterThan(r.z0)
        expect(w.z).toBeLessThan(r.z1)
      }
    }
  })
})

describe('Live site: offices ↔ KPI subjects', () => {
  it('matches the real names, work orders without leading zeros, and lists TPD as not on the map', () => {
    const links = linkOffices(data([kpi('sib', '', '2026-09', 60)]))
    const of = (key: string) => links.offices.get(key)
    expect(of('earthworks')?.subjects.map((s) => s.key)).toEqual(['w823'])
    expect(of('cluster-882')?.subjects.map((s) => s.key)).toEqual(['w882'])
    expect(of('coastGuard')?.subjects.map((s) => s.key)).toEqual(['w1272'])
    expect(of('culvert')?.subjects.map((s) => s.key)).toEqual(['w1112'])
    expect(of('bridge')?.subjects.map((s) => s.key)).toEqual(['w1134'])
    expect(of('seawall')?.subjects.map((s) => s.key)).toEqual(['w876'])
    expect(of('port')?.label).toBe('ECH · WO 1131')
    // look-alikes kept apart
    expect(of('pipeline')?.contractor.uuid).toBe('ppc')
    expect(of('roadEast')?.contractor.uuid).toBe('rpc')
    expect(of('reservoir')?.contractor.uuid).toBe('sha')
    expect(of('cluster-sibs')?.contractor.uuid).toBe('sib')
    // switched-off SIBS still has its own bar
    expect(of('cluster-sibs')).toMatchObject({ off: true, label: 'SIBS' })
    expect(links.unmapped.map((s) => s.key)).toEqual(['w892'])
    expect(links.missing).toEqual([])
    expect(woKey('0876')).toBe(woKey('876'))
    expect(woKey('0')).toBe('0')
  })

  it('a switched-off contractor without KPI rows has no office', () => {
    const links = linkOffices(data())
    expect(links.offices.has('cluster-sibs')).toBe(false)
    expect(links.missing).toEqual(['cluster-sibs'])
  })
})

describe('Live site: health', () => {
  it('bar fill and status from the overall KPI', () => {
    const r = (overall: number | null) => ({ overall }) as KpiResult
    expect([0, 69, 70, 90, 100].map((v) => healthOf('x', r(v)).status)).toEqual(['bad', 'bad', 'warn', 'good', 'good'])
    expect(healthOf('x', r(69)).fill).toBeCloseTo(0.69)
    expect(healthOf('x', r(100)).fill).toBe(1)
    expect(healthOf('x', r(null))).toMatchObject({ status: 'none', fill: 0 })
    expect(healthOf('x', r(100)).parts).toHaveLength(8)
  })

  it('site-wide KPI is the 2D number; switched-off SIBS is shown but not counted', () => {
    const kpis = [kpi('ech', 'w1131', '2026-09', 80), kpi('sam', '', '2026-09', 20, false), kpi('sib', '', '2026-09', 100)]
    const d = data(kpis)
    const links = linkOffices(d)
    const m = siteMonth(d, links, '2026-09')
    expect(m.overall).toBe(itemStats(subjectKpis(d, '2026-09'), 'overall').avg)
    expect(m.offices.get('port')).toMatchObject({ overall: 90, status: 'good' })
    expect(m.offices.get('roadWest')).toMatchObject({ overall: 10, status: 'bad' })
    expect(m.offices.get('cluster-sibs')).toMatchObject({ overall: 100, status: 'good' })
    expect(m.counts).toMatchObject({ good: 1, bad: 1 })
    expect(m.unmapped).toEqual([expect.objectContaining({ status: 'none' })])
  })

  it('tour: critical then at risk, worst first, ends on the whole site', () => {
    const kpis = [kpi('ech', 'w1131', '2026-09', 50), kpi('sam', '', '2026-09', 20, false), kpi('rpc', '', '2026-09', 50, false), kpi('ppc', 'w1322', '2026-09', 60)]
    const d = data(kpis)
    const links = linkOffices(d)
    const tour = buildTour(links, siteMonth(d, links, '2026-09'))
    // SAMA 10, RPCO 25, ECH 75, PPCO 80
    expect(tour.map((s) => s.officeKey)).toEqual(['roadWest', 'roadEast', 'port', 'pipeline', undefined])
    expect(tour.map((s) => s.tone)).toEqual(['bad', 'bad', 'warn', 'warn', 'bad'])
    expect(tour[tour.length - 1]?.text).toMatch(/^Whole site: KPI/)
  })

  it('months: the last 12 without leading months that have no KPI rows', () => {
    expect(siteMonths(data([kpi('ech', 'w1131', '2026-05', 80)]), '2026-11-01')).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'])
    expect(siteMonths(data(), '2026-11-01')).toHaveLength(12)
  })
})

describe('Live site: layout editing', () => {
  const plant = SITE_BY_ID.get('plant')!
  const port = SITE_BY_ID.get('port')!

  it('turns about the centre and swaps the footprint; coast sites keep facing the sea', () => {
    const p = rotatePlace(plant, plant.home)
    expect(p.rot).toBe(1)
    expect([footprint(plant, p).x1 - footprint(plant, p).x0, footprint(plant, p).z1 - footprint(plant, p).z0]).toEqual([10, 12])
    expect(rotatePlace(plant, rotatePlace(plant, rotatePlace(plant, p)))).toEqual(plant.home)
    expect(rotatePlace(port, port.home)).toEqual(port.home)
  })

  it('snaps a drag to tiles; coast sites only slide along the shore', () => {
    expect(snapPlace(plant, plant.home, 10.4, -3.6, { ox: 2.1, oz: 1.2 })).toEqual({ gx: 8, gz: -5, rot: 0 })
    expect(snapPlace(port, port.home, 3.2, -15, { ox: 8, oz: 2 })).toEqual({ gx: -5, gz: port.home.gz, rot: 0 })
  })

  it('fit check: land sites anywhere on land (mainland, port land, outside the octagon); not in the basin, the sea or the floating city', () => {
    const at = (id: string, gx: number, gz: number, rot: Rot = 0): Layout => ({ ...homeLayout(), [id]: { gx, gz, rot } })
    // outside the octagon (mainland) is allowed: the project extends beyond it
    expect(insideOctagon(105, -30)).toBe(false)
    expect(fitCheck(at('plant', 110, -30), 'plant')).toMatchObject({ ok: true })
    expect(fitCheck(at('plant', 145, -30), 'plant')).toMatchObject({ ok: false, reason: 'outside' })
    expect(fitCheck(at('plant', 0, -26), 'plant')).toMatchObject({ ok: false, reason: 'overlap', other: 'culvert' })
    // port land west of the basin is land; the basin, the open sea and the floating city are not
    expect(fitCheck(at('reservoir', -80, 10), 'reservoir')).toMatchObject({ ok: true })
    expect(fitCheck(at('reservoir', -30, 10), 'reservoir')).toMatchObject({ ok: false, reason: 'shore' })
    expect(fitCheck(at('reservoir', 0, 50), 'reservoir')).toMatchObject({ ok: false, reason: 'shore' })
    expect(fitCheck(at('pipeline', 80, -20, 1), 'pipeline')).toMatchObject({ ok: false, reason: 'shore' })
    // coast sites slide along the basin's north quay, but not past its ends
    expect(fitCheck(at('seawall', 50, port.home.gz), 'seawall')).toMatchObject({ ok: true })
    expect(fitCheck(at('seawall', 65, port.home.gz), 'seawall')).toMatchObject({ ok: false, reason: 'shore' })
    expect(fitCheck(at('seawall', -70, port.home.gz), 'seawall')).toMatchObject({ ok: false, reason: 'shore' })
    expect(canEditLayout('admin')).toBe(true)
    expect(canEditLayout('editor')).toBe(false)
    expect(canEditLayout('viewer')).toBe(false)
  })

  it('coast sites follow the quay when the basin is moved', () => {
    const items = DEFAULT_ITEMS.map((i) => (i.kind === 'basin' ? { ...i, points: i.points!.map(([x, z]) => [x, z + 4] as [number, number]) } : i))
    const zones = zonesOf(items)
    const l = alignCoast(homeLayout(), zones)
    expect(l.port.gz).toBe(port.home.gz + 4)
    expect(l.plant).toEqual(plant.home)
    for (const s of SITES) expect([s.id, fitCheck(l, s.id, zones).ok]).toEqual([s.id, true])
    // without the shift the port would sit on the old quay line, half on land
    expect(fitCheck(homeLayout(), 'port', zones)).toMatchObject({ ok: false, reason: 'shore' })
  })

  it('saved rows: unknown or broken rows are ignored; coast rows keep their quay line; old rows carry over', () => {
    const l = layoutFrom([
      { siteId: 'plant', gx: 12, gz: -9, rot: 1, v: 3 },
      { siteId: 'nope', gx: 0, gz: 0, rot: 0, v: 3 },
      { siteId: 'culvert', gx: 1.5, gz: 0, rot: 0, v: 3 },
      { siteId: 'reservoir', gx: 0, gz: 0, rot: 7, v: 3 },
      { siteId: 'port', gx: -6, gz: -3, rot: 2, v: 3 },
      // saved with the bigger octagon (v2): moves 6 tiles north with the land half
      { siteId: 'earthworks', gx: 2, gz: -40, rot: 0, v: 2 },
      // saved with the first (smaller) octagon: 2 tiles right of its old default
      { siteId: 'bridge', gx: -1, gz: 0, rot: 0 },
    ])
    expect(l.plant).toEqual({ gx: 12, gz: -9, rot: 1 })
    expect(l.culvert).toEqual(SITE_BY_ID.get('culvert')!.home)
    expect(l.reservoir).toEqual(SITE_BY_ID.get('reservoir')!.home)
    expect(l.port).toEqual({ gx: -6, gz: port.home.gz, rot: 0 })
    expect(l.earthworks).toEqual({ gx: 2, gz: -46, rot: 0 })
    const bridge = SITE_BY_ID.get('bridge')!.home
    expect(l.bridge).toEqual({ gx: bridge.gx + 2, gz: bridge.gz, rot: 0 })
    expect(Object.keys(l)).toHaveLength(12)
  })
})

describe('Live site: manpower', () => {
  const mp = (contractorUuid: string, workOrderUuid: string, month: string, totalWorkers: number): Manpower =>
    ({ uuid: `${contractorUuid}${workOrderUuid}${month}`, updatedAt: '', contractorUuid, workOrderUuid, month, totalWorkers, illegalOrFreelance: 0, visaExpiring30d: 0, paidRecruitmentFees: 0 }) as Manpower

  it('each office shows its latest count up to the month, never a later one', () => {
    const links = linkOffices(data())
    const rows = [mp('sam', '', '2026-08', 2800), mp('sam', '', '2026-09', 3000), mp('sam', '', '2026-11', 3500), mp('fah', 'w823', '2026-07', 120), mp('ppc', 'w1322', '2026-09', 0)]
    const crews = officeCrews(rows, links, '2026-10')
    expect(crews.get('roadWest')).toEqual({ workers: 3000, month: '2026-09' })
    expect(crews.get('earthworks')).toEqual({ workers: 120, month: '2026-07' })
    expect(crews.has('pipeline')).toBe(false)
    expect(crews.has('port')).toBe(false)
  })

  it('one figure stands for a round number of people; a 3,000 crew stays drawable', () => {
    expect(crewScale(150, 200)).toBe(1)
    expect(crewScale(3120, 200)).toBe(20)
    expect(crewScale(12000, 100)).toBe(200)
    expect(figuresFor(3000, 20)).toBe(150)
    expect(figuresFor(5, 20)).toBe(1)
    expect(figuresFor(0, 20)).toBe(0)
  })
})
