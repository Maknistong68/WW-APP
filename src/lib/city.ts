import { ageDays, isOpen } from './aging'
import { buildAttention, type Attention } from './attention'
import { hash } from './art'
import { campState, DEFAULT_CYCLE_DAYS, type CampStatus } from './camps'
import { closeoutState } from './closeout'
import { openOn } from './dashboard'
import { localDate, monthOf, monthRange } from './dates'
import { KPI_PARTS, kpiStatus, type KpiResult, type KpiStatus } from './kpi'
import { kpiForSubject, type AllData } from './kpiData'
import { kpiSubjects, subjectKpi, subjectManpower, woOf, type KpiSubject } from './subjects'
import { quarterMonths } from './todo'
import type { Contractor, Ticket } from '../types'

// "Living Site": the app's data as a small 3D city for one month.
// Pure and deterministic — positions never change between months, so the
// 3D view can animate what changed instead of reshuffling.

/** The 8 KPI items that make a tower's floors, bottom to top (quarterly is not averaged). */
export const FLOORS = KPI_PARTS.filter((p) => p.key !== 'quarterly')

export const CELL = 7.5 // block pitch (world units)
const TOWER_GAP = 2.1
const TOWERS_PER_ROW = 3

export interface CityTower {
  key: string
  contractorUuid: string
  /** "WO 882" or the contractor name */
  label: string
  subjectLabel: string
  x: number
  z: number
  height: number
  workers: number | null
  illegal: number
  visaExpiring: number
  floors: KpiStatus[]
  floorValues: (number | null)[]
  overall: number | null
  status: KpiStatus
  /** WPS, manpower declaration, salary declaration */
  submissions: [boolean, boolean, boolean]
  findings: { total: number; closed: number; status: 'overdue' | 'due' | 'open' | 'closed' } | null
}

export interface CityBlock {
  contractorUuid: string
  name: string
  active: boolean
  x: number
  z: number
  w: number
  d: number
  towers: string[]
  overall: number | null
  status: KpiStatus
  openTickets: number
  owed: number
  /** Gold coins in the stack (∝ √SAR) */
  coins: number
}

export interface CityTicket {
  uuid: string
  ticketNo: string
  contractorUuid: string
  towerKey: string
  /** 0 = 0–10 days, 1 = 11–30, 2 = over 30 */
  ring: 0 | 1 | 2
  angle: number
  size: number
  age: number
  workers: number
  owed: number
  issue: string
  /** Main ticket of a combined group (draws a link). */
  parentUuid: string
}

export interface CityCamp {
  uuid: string
  name: string
  x: number
  z: number
  status: CampStatus
  /** Days left in the cycle (negative = overdue), null when never inspected. */
  daysLeft: number | null
  /** 0..1 of the cycle still left (ring arc). */
  fraction: number
  lastDate: string
  inspectedThisMonth: boolean
}

export interface TourStop extends Attention {
  x: number
  z: number
}

export interface City {
  month: string
  /** The month's last day, or today for the current month. */
  asOf: string
  blocks: CityBlock[]
  towers: CityTower[]
  tickets: CityTicket[]
  camps: CityCamp[]
  tide: { open: number; level: number; max: number }
  /** SAR recovered on tickets closed this month (flies to the vault). */
  recovered: number
  sky: { overall: number | null; status: KpiStatus }
  tour: TourStop[]
  /** Radius of the built-up area (blocks). */
  inner: number
  /** Island radius (blocks + camps ring). */
  radius: number
}

/** Tower height from workers declared: √ scale, stub when there is no data. */
export const towerHeight = (workers: number | null | undefined) => (workers ? 2.6 + Math.sqrt(workers) / 4.5 : 2.2)

/** Coins in a stack for SAR owed (√ scale, capped). */
export const coinCount = (sar: number) => (sar > 0 ? Math.min(40, Math.max(1, Math.round(Math.sqrt(sar / 1000)))) : 0)

export const ageRing = (age: number): 0 | 1 | 2 => (age > 30 ? 2 : age > 10 ? 1 : 0)

/** Stable angle (radians) from an id. */
export const angleOf = (id: string) => ((hash(id) % 3600) / 3600) * Math.PI * 2

/** Contractors on the map: active ones, plus inactive ones that still have open tickets. */
function cityContractors(d: AllData, asOf: string): Contractor[] {
  const withTickets = new Set(d.tickets.filter((t) => t.contractorUuid && openOn(t, asOf)).map((t) => t.contractorUuid))
  return d.contractors.filter((c) => c.active || withTickets.has(c.uuid)).sort((a, b) => a.name.localeCompare(b.name))
}

/** Grid of blocks (sorted by name), centred on the origin. `aspect` (width/height) makes it taller on phones. */
export function layout(names: { uuid: string; towers: number }[], aspect = 1) {
  const a = Math.max(0.45, Math.min(2.2, aspect))
  const cols = Math.max(1, Math.min(names.length, Math.ceil(Math.sqrt(names.length * a))))
  const rows = Math.max(1, Math.ceil(names.length / cols))
  return names.map((n, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const perRow = Math.min(TOWERS_PER_ROW, Math.max(1, n.towers))
    const towerRows = Math.max(1, Math.ceil(n.towers / TOWERS_PER_ROW))
    return {
      uuid: n.uuid,
      x: (col - (cols - 1) / 2) * CELL,
      z: (row - (rows - 1) / 2) * CELL,
      w: perRow * TOWER_GAP + 1.6,
      d: towerRows * TOWER_GAP + 1.6,
      perRow,
      towerRows,
    }
  })
}

function towerFor(result: KpiResult) {
  const floorValues = FLOORS.map((f) => result[f.key])
  return { floorValues, floors: floorValues.map((v) => kpiStatus(v)) }
}

/** Build the city for one month. `scaleMax` normalises the tide across a timeline. */
export function buildCity(d: AllData, month: string, today = localDate(), scaleMax?: number, aspect = 1): City {
  const { start, end } = monthRange(month)
  const asOf = end < today ? end : today
  const contractors = cityContractors(d, asOf)
  const allSubjects = kpiSubjects(d.contractors, d.workOrders)
  const subjectsOf = (c: Contractor): KpiSubject[] => {
    const own = allSubjects.filter((s) => s.contractor.uuid === c.uuid)
    return own.length ? own : [{ key: c.uuid, contractor: c, label: c.name }]
  }
  const placed = layout(contractors.map((c) => ({ uuid: c.uuid, towers: subjectsOf(c).length })), aspect)
  const openTickets = d.tickets.filter((t) => openOn(t, asOf))

  const blocks: CityBlock[] = []
  const towers: CityTower[] = []
  contractors.forEach((c, i) => {
    const p = placed[i]
    const subjects = subjectsOf(c)
    const keys: string[] = []
    const results: (number | null)[] = []
    subjects.forEach((s, j) => {
      const col = j % p.perRow
      const row = Math.floor(j / p.perRow)
      const result = kpiForSubject(d, s, month)
      const mp = subjectManpower(s, d.manpower, month)
      const k = subjectKpi(s, d.kpis, month)
      // Close-out: the latest audit this quarter (up to this month) with findings.
      const qMonths = quarterMonths(month).filter((m) => m <= month).reverse()
      let findings: CityTower['findings'] = null
      for (const m of qMonths) {
        const st = closeoutState(subjectKpi(s, d.kpis, m), asOf)
        if (st) {
          findings = { total: st.findings, closed: st.closed, status: st.status }
          break
        }
      }
      const { floors, floorValues } = towerFor(result)
      towers.push({
        key: s.key,
        contractorUuid: c.uuid,
        label: s.workOrder ? `WO ${s.workOrder.number}` : c.name,
        subjectLabel: s.label,
        x: p.x + (col - (Math.min(p.perRow, subjects.length) - 1) / 2) * TOWER_GAP,
        z: p.z + (row - (p.towerRows - 1) / 2) * TOWER_GAP,
        height: towerHeight(mp?.totalWorkers),
        workers: mp?.totalWorkers ?? null,
        illegal: mp?.illegalOrFreelance ?? 0,
        visaExpiring: mp?.visaExpiring30d ?? 0,
        floors,
        floorValues,
        overall: result.overall,
        status: c.active ? result.status : 'none',
        submissions: [!!k?.wps, !!k?.manpowerDecl, !!k?.salaryDecl],
        findings,
      })
      keys.push(s.key)
      results.push(result.overall)
    })
    const own = openTickets.filter((t) => t.contractorUuid === c.uuid)
    const owed = own.reduce((s, t) => s + (t.amountOwed ?? 0), 0)
    const vals = results.filter((v): v is number => v !== null)
    const overall = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    blocks.push({
      contractorUuid: c.uuid,
      name: c.name,
      active: c.active,
      x: p.x,
      z: p.z,
      w: p.w,
      d: p.d,
      towers: keys,
      overall,
      status: c.active ? kpiStatus(overall) : 'none',
      openTickets: own.length,
      owed,
      coins: coinCount(owed),
    })
  })

  const towerOfTicket = (t: Ticket) => {
    const byWo = t.workOrderUuid && towers.find((tw) => tw.key === t.workOrderUuid)
    if (byWo) return byWo.key
    return towers.find((tw) => tw.contractorUuid === t.contractorUuid)?.key ?? ''
  }
  const tickets: CityTicket[] = openTickets
    .filter((t) => t.contractorUuid && blocks.some((b) => b.contractorUuid === t.contractorUuid))
    .map((t) => {
      const age = ageDays({ ...t, status: 'Open', closedAt: '' }, asOf)
      return {
        uuid: t.uuid,
        ticketNo: t.ticketNo,
        contractorUuid: t.contractorUuid,
        towerKey: towerOfTicket(t),
        ring: ageRing(age),
        angle: angleOf(t.uuid),
        size: 0.14 + 0.05 * Math.log2(1 + (t.workers || 1)),
        age,
        workers: t.workers || 0,
        owed: t.amountOwed ?? 0,
        issue: t.issue,
        parentUuid: t.parentUuid ?? '',
      }
    })

  // Camps on a ring around the city.
  const cityRadius = Math.max(...blocks.map((b) => Math.hypot(b.x, b.z) + Math.max(b.w, b.d) / 2), CELL)
  const campRadius = cityRadius + 6
  const activeCamps = d.camps.filter((c) => c.active).sort((a, b) => a.name.localeCompare(b.name))
  const seen = d.inspections.filter((i) => (i.info?.reviewDate ?? '') && i.info.reviewDate <= asOf)
  const camps: CityCamp[] = activeCamps.map((camp, i) => {
    const st = campState(camp, seen, asOf)
    const cycle = camp.cycleDays || DEFAULT_CYCLE_DAYS
    const a = (i / Math.max(1, activeCamps.length)) * Math.PI * 2 + Math.PI / 5
    return {
      uuid: camp.uuid,
      name: camp.name,
      x: Math.cos(a) * campRadius,
      z: Math.sin(a) * campRadius,
      status: st.status,
      daysLeft: st.dueIn,
      fraction: st.dueIn === null ? 0 : Math.max(0, Math.min(1, st.dueIn / cycle)),
      lastDate: st.lastDate,
      inspectedThisMonth: !!st.lastDate && st.lastDate >= start && st.lastDate <= end,
    }
  })

  const overallVals = towers.filter((t) => t.status !== 'none' && t.overall !== null).map((t) => t.overall as number)
  const skyOverall = overallVals.length ? overallVals.reduce((a, b) => a + b, 0) / overallVals.length : null
  const recovered = d.tickets
    .filter((t) => !isOpen(t) && t.closedAt >= start && t.closedAt <= end)
    .reduce((s, t) => s + (t.amountOwed ?? 0), 0)

  const where = (a: Attention) => {
    if (a.focus?.kind === 'camp') {
      const c = camps.find((x) => x.uuid === a.focus!.uuid)
      if (c) return { x: c.x, z: c.z }
    }
    if (a.focus?.kind === 'contractor') {
      const b = blocks.find((x) => x.contractorUuid === a.focus!.uuid)
      if (b) return { x: b.x, z: b.z }
    }
    return { x: 0, z: 0 }
  }
  const tour = buildAttention(d, month, asOf).map((a) => ({ ...a, ...where(a) }))

  const max = Math.max(scaleMax ?? 0, openTickets.length, 1)
  return {
    month,
    asOf,
    blocks,
    towers,
    tickets,
    camps,
    tide: { open: openTickets.length, level: openTickets.length / max, max },
    recovered,
    sky: { overall: skyOverall, status: kpiStatus(skyOverall) },
    tour,
    inner: cityRadius,
    radius: campRadius + 3,
  }
}

/** One city per month; the tide is scaled to the busiest month so it can rise and fall. */
export function buildTimeline(d: AllData, months: string[], today = localDate(), aspect = 1): City[] {
  const opens = months.map((m) => {
    const { end } = monthRange(m)
    const asOf = end < today ? end : today
    return d.tickets.filter((t) => openOn(t, asOf)).length
  })
  const max = Math.max(1, ...opens)
  return months.map((m) => buildCity(d, m, today, max, aspect))
}

/** Months up to the current one that the timeline covers. */
export const timelineMonths = (n = 12, today = localDate()) => {
  const out: string[] = []
  const cur = monthOf(today)
  let [y, m] = cur.split('-').map(Number)
  for (let i = 0; i < n; i++) {
    out.unshift(`${y}-${String(m).padStart(2, '0')}`)
    m--
    if (m === 0) {
      m = 12
      y--
    }
  }
  return out
}

/** Which tower a subject maps to (for links from other screens). */
export const towerKeyOf = (s: KpiSubject) => woOf(s) || s.contractor.uuid
