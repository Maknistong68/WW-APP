import { lastMonths } from './dashboard'
import { addMonths, daysBetween, localDate, monthRange } from './dates'
import { lastEndedMonth } from './due'
import { KPI_PARTS } from './kpi'
import { kpiForSubject, rollup, type AllData, type KpiItemKey } from './kpiData'
import type { KpiSubject } from './subjects'
import { closedIn, monthEnd, openOn, openedIn } from './ticketFilter'
import type { Contractor, Ticket } from '../types'

// History for one contractor, month by month (the contractor's Trends tab).
// A month with no data is null (a gap on the chart), never 0. Work orders that
// have since been switched off still count in the months they have data for.

export type TrendRange = '6m' | '1y' | 'all'

/** Every work order of the contractor, switched off or not (or the contractor itself without any). */
export function contractorSubjects(d: AllData, c: Contractor): KpiSubject[] {
  const wos = d.workOrders.filter((w) => w.contractorUuid === c.uuid)
  if (!wos.length) return [{ key: c.uuid, contractor: c, label: c.name }]
  return wos.map((w) => ({ key: w.uuid, contractor: c, workOrder: w, label: `${c.name} · WO ${w.number}` }))
}

const pick = (d: AllData, c: Contractor, wo?: string) => contractorSubjects(d, c).filter((s) => !wo || s.workOrder?.uuid === wo)
const mine = (d: AllData, c: Contractor, wo?: string) => d.tickets.filter((t) => t.contractorUuid === c.uuid && (!wo || t.workOrderUuid === wo))
const round = (v: number | null) => (v === null ? null : Math.round(v))

/** The months a range shows, oldest first, ending with the last month that ended. */
export function trendMonths(d: AllData, c: Contractor, range: TrendRange, today = localDate()): string[] {
  const end = lastEndedMonth(today)
  if (range === '6m') return lastMonths(end, 6)
  if (range === '1y') return lastMonths(end, 12)
  const firsts = [
    ...d.kpis.filter((k) => k.contractorUuid === c.uuid).map((k) => k.month),
    ...d.manpower.filter((m) => m.contractorUuid === c.uuid).map((m) => m.month),
    ...d.tickets.filter((t) => t.contractorUuid === c.uuid && t.openedAt).map((t) => t.openedAt.slice(0, 7)),
  ].filter((m) => m && m <= end)
  if (!firsts.length) return [end]
  const first = firsts.reduce((a, b) => (a < b ? a : b))
  const out: string[] = []
  for (let m = first; m <= end; m = addMonths(m, 1)) out.push(m)
  return out.slice(-36)
}

/** Every KPI item (and the overall) per month, for all work orders or one. */
export function contractorKpiSeries(d: AllData, c: Contractor, months: string[], wo?: string): Record<KpiItemKey, (number | null)[]> {
  const subjects = pick(d, c, wo)
  const keys: KpiItemKey[] = [...KPI_PARTS.map((p) => p.key), 'overall']
  const out = Object.fromEntries(keys.map((k) => [k, [] as (number | null)[]])) as Record<KpiItemKey, (number | null)[]>
  for (const m of months) {
    const results = subjects.map((s) => kpiForSubject(d, s, m))
    const r = results.length === 1 ? results[0] : rollup(results)
    for (const k of keys) out[k].push(round(r[k]))
  }
  return out
}

/** The contractor's overall KPI for each month (its work orders averaged). */
export function contractorOverall(d: AllData, c: Contractor, months: string[]): (number | null)[] {
  return contractorKpiSeries(d, c, months).overall
}

export interface TicketMonth {
  opened: number
  closed: number
  /** Average days to close the tickets closed that month. */
  avgDaysToClose: number | null
  openAtEnd: number
}

export function contractorTicketSeries(d: AllData, c: Contractor, months: string[], wo?: string, today = localDate()): TicketMonth[] {
  const list = mine(d, c, wo)
  return months.map((m) => {
    const closed = list.filter((t) => closedIn(t, m))
    const end = monthEnd(m, today)
    return {
      opened: list.filter((t) => openedIn(t, m)).length,
      closed: closed.length,
      avgDaysToClose: closed.length ? closed.reduce((s, t) => s + daysBetween(t.openedAt, t.closedAt), 0) / closed.length : null,
      openAtEnd: list.filter((t) => openOn(t, end)).length,
    }
  })
}

const owed = (t: Ticket) => (typeof t.amountOwed === 'number' && t.amountOwed > 0 ? t.amountOwed : 0)

/** SAR still owed at each month's end, and recovered (tickets closed) in each month. */
export function contractorMoneySeries(d: AllData, c: Contractor, months: string[], wo?: string, today = localDate()) {
  const list = mine(d, c, wo)
  return months.map((m) => {
    const end = monthEnd(m, today)
    return {
      owedAtEnd: list.filter((t) => openOn(t, end)).reduce((s, t) => s + owed(t), 0),
      recovered: list.filter((t) => closedIn(t, m)).reduce((s, t) => s + owed(t), 0),
    }
  })
}

/** Declared workers per month (counts only), null for a month nobody declared. */
export function contractorWorkforceSeries(d: AllData, c: Contractor, months: string[], wo?: string) {
  return months.map((m) => {
    const rows = d.manpower.filter((r) => r.contractorUuid === c.uuid && r.month === m && (!wo || r.workOrderUuid === wo))
    if (!rows.length) return null
    return {
      total: rows.reduce((s, r) => s + r.totalWorkers, 0),
      illegal: rows.reduce((s, r) => s + r.illegalOrFreelance, 0),
      visas: rows.reduce((s, r) => s + r.visaExpiring30d, 0),
      paidFees: rows.reduce((s, r) => s + r.paidRecruitmentFees, 0),
    }
  })
}

/** The latest value, its change since the month before it, and months on track (≥ 90). */
export function trendSummary(values: (number | null)[]) {
  const known = values.filter((v): v is number => v !== null)
  const now = known.length ? known[known.length - 1] : null
  const prev = known.length > 1 ? known[known.length - 2] : null
  return {
    now,
    prev,
    change: now !== null && prev !== null ? now - prev : null,
    onTrack: known.filter((v) => v >= 90).length,
    months: known.length,
  }
}

/** What made a month's score, in a few words ("2 closed · avg 19 days"). Empty when it's simply typed in. */
export function itemInputs(d: AllData, c: Contractor, key: KpiItemKey, month: string, wo?: string): string {
  if (key === 'grievance') {
    const closed = mine(d, c, wo).filter((t) => closedIn(t, month))
    if (!closed.length) return 'No tickets closed'
    const avg = closed.reduce((s, t) => s + daysBetween(t.openedAt, t.closedAt), 0) / closed.length
    return `${closed.length} closed · avg ${Math.round(avg)} days`
  }
  if (key === 'closure') {
    const { start, end } = monthRange(month)
    const during = mine(d, c, wo).filter((t) => {
      if (!t.openedAt || t.openedAt > end) return false
      if (t.status !== 'Closed') return true
      return !!t.closedAt && t.closedAt >= start
    })
    if (!during.length) return 'No tickets'
    return `${during.filter((t) => closedIn(t, month)).length} of ${during.length} closed`
  }
  if (key === 'formal') {
    const w = contractorWorkforceSeries(d, c, [month], wo)[0]
    return w ? `${w.total} workers · ${w.illegal} illegal` : 'No worker count'
  }
  if (key === 'submission') {
    const missing = new Set<string>()
    for (const s of pick(d, c, wo)) {
      const k = d.kpis.find((x) => x.contractorUuid === c.uuid && (x.workOrderUuid || '') === (s.workOrder?.uuid ?? '') && x.month === month)
      if (!k) continue
      if (!k.wps) missing.add('WPS')
      if (!k.manpowerDecl) missing.add('Manpower')
      if (!k.salaryDecl) missing.add('Salary')
    }
    return missing.size ? `${[...missing].join(', ')} missing` : 'WPS, manpower, salary in'
  }
  return ''
}
