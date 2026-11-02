import { AGING_BUCKETS, ageDays, agingBucket, isOpen, type AgingBucket } from './aging'
import { campState, type CampState } from './camps'
import { addDays, addMonths, daysBetween, localDate, monthRange } from './dates'
import { submissionsComplete } from './kpi'
import { inspectionPct } from './inspectionScore'
import { subjectKpi, subjectManpower, type KpiSubject } from './subjects'
import type { Camp, Contractor, Inspection, KpiMonth, Manpower, Ticket, WeeklyCount } from '../types'

// Month rules shared with the Tickets list filters (src/lib/ticketFilter.ts),
// so a number and the list it opens always agree.
import { closedIn, lateOn, openOn, openedIn } from './ticketFilter'
export { openOn }

export interface TrendPoint {
  date: string
  open: number
  imported: boolean
}

/**
 * Weekly open system tickets: the imported weekly snapshots, then one point per
 * week computed from ticket dates up to today.
 */
export function weeklyTrend(weekly: WeeklyCount[], tickets: Ticket[], today = localDate()): TrendPoint[] {
  const points: TrendPoint[] = [...weekly]
    .sort((a, b) => a.weekEnding.localeCompare(b.weekEnding))
    .map((w) => ({ date: w.weekEnding, open: w.openTickets, imported: true }))
  const system = tickets.filter((t) => t.source === 'System')
  let d = points.length ? addDays(points[points.length - 1].date, 7) : addDays(today, -7 * 12)
  while (d <= today) {
    points.push({ date: d, open: system.filter((t) => openOn(t, d)).length, imported: false })
    d = addDays(d, 7)
  }
  return points
}

export interface Count {
  key: string
  label: string
  count: number
  workers: number
}

function countBy(tickets: Ticket[], keyOf: (t: Ticket) => string, labelOf: (k: string) => string): Count[] {
  const m = new Map<string, Count>()
  for (const t of tickets) {
    const key = keyOf(t) || '—'
    const c = m.get(key) ?? { key, label: labelOf(key), count: 0, workers: 0 }
    c.count++
    c.workers += t.workers || 0
    m.set(key, c)
  }
  return [...m.values()].sort((a, b) => b.count - a.count || b.workers - a.workers)
}

export interface PeriodStats {
  opened: Ticket[]
  closed: Ticket[]
  openAtEnd: number
  over30AtEnd: number
  workersOpened: number
  avgDaysToClose: number | null
  byContractor: Count[]
  byIssue: Count[]
}

/** Stats for a month (YYYY-MM) or all time (null). */
export function periodStats(
  tickets: Ticket[],
  month: string | null,
  contractors: Map<string, Contractor>,
  today = localDate(),
): PeriodStats {
  const range = month ? monthRange(month) : { start: '0000-01-01', end: today }
  const end = range.end < today ? range.end : today
  const inRange = (d: string) => d >= range.start && d <= range.end
  const opened = month ? tickets.filter((t) => openedIn(t, month)) : tickets.filter((t) => inRange(t.openedAt))
  const closed = month
    ? tickets.filter((t) => closedIn(t, month))
    : tickets.filter((t) => t.status === 'Closed' && !!t.closedAt && inRange(t.closedAt))
  const openEnd = tickets.filter((t) => openOn(t, end))
  const avg = closed.length
    ? closed.reduce((s, t) => s + daysBetween(t.openedAt, t.closedAt), 0) / closed.length
    : null
  return {
    opened,
    closed,
    openAtEnd: openEnd.length,
    over30AtEnd: openEnd.filter((t) => lateOn(t, end)).length,
    workersOpened: opened.reduce((s, t) => s + (t.workers || 0), 0),
    avgDaysToClose: avg,
    byContractor: countBy(opened, (t) => t.contractorUuid, (k) => contractors.get(k)?.name ?? 'No contractor'),
    byIssue: countBy(opened, (t) => t.issue, (k) => k),
  }
}

/** Active work orders / contractors whose WPS, manpower and salary aren't all in for the month. */
export function missingSubmissions(subjects: KpiSubject[], kpis: KpiMonth[], month: string): KpiSubject[] {
  return subjects.filter((s) => !submissionsComplete(subjectKpi(s, kpis, month)))
}

/** Oldest open tickets past 30 days, oldest first. */
export const overdueTickets = (tickets: Ticket[], today = localDate()) =>
  tickets
    .filter((t) => isOpen(t) && ageDays(t, today) > 30)
    .sort((a, b) => ageDays(b, today) - ageDays(a, today))

// ---------------------------------------------------------------------------
// Dashboard: monthly series and the numbers that matter across the app.
// ---------------------------------------------------------------------------

/** The `n` months ending with `month`, oldest first. */
export const lastMonths = (month: string, n: number): string[] =>
  Array.from({ length: n }, (_, i) => addMonths(month, i - n + 1))

export interface MonthPoint {
  month: string
  values: number[]
}

/** Tickets opened and closed per month. */
export function ticketsPerMonth(tickets: Ticket[], months: string[]): MonthPoint[] {
  return months.map((m) => ({
    month: m,
    values: [
      tickets.filter((t) => t.openedAt?.startsWith(m)).length,
      tickets.filter((t) => t.status === 'Closed' && t.closedAt?.startsWith(m)).length,
    ],
  }))
}

/** SAR recovered per month: money on tickets closed that month (only the main ticket of a group carries it). */
export function recoveredPerMonth(tickets: Ticket[], months: string[]): MonthPoint[] {
  return months.map((m) => ({
    month: m,
    values: [
      tickets
        .filter((t) => t.status === 'Closed' && t.closedAt?.startsWith(m))
        .reduce((s, t) => s + (t.amountOwed ?? 0), 0),
    ],
  }))
}

export interface AgingRow {
  bucket: AgingBucket
  count: number
  workers: number
  /** SAR still owed on these tickets. */
  owed: number
}

/** Open tickets by age: 0-10 / 11-30 / 31-60 / 61-90 / 90+ days. */
export function openAging(tickets: Ticket[], today = localDate()): AgingRow[] {
  const rows = AGING_BUCKETS.map((bucket) => ({ bucket, count: 0, workers: 0, owed: 0 }))
  for (const t of tickets) {
    if (!isOpen(t)) continue
    const r = rows.find((x) => x.bucket === agingBucket(ageDays(t, today)))!
    r.count++
    r.workers += t.workers || 0
    r.owed += t.amountOwed ?? 0
  }
  return rows
}

/** Count tickets by any field, biggest first. */
export const ticketsBy = (tickets: Ticket[], keyOf: (t: Ticket) => string) =>
  countBy(tickets, keyOf, (k) => k)

export interface Workforce {
  /** Month the numbers come from (latest with data at or before the asked month). */
  month: string | null
  total: number
  illegal: number
  visaExpiring: number
  paidFees: number
  /** Share of workers that are formal, 0–100. */
  formalPct: number | null
  /** Subjects with no declaration for that month. */
  missing: number
  byContractor: { key: string; label: string; total: number; illegal: number }[]
}

/** Manpower counts for active work orders (counts only — no personal data). */
export function workforce(subjects: KpiSubject[], manpower: Manpower[], month: string): Workforce {
  const active = new Set(subjects.map((s) => s.key))
  const keyOf = (m: Manpower) => m.workOrderUuid || m.contractorUuid
  const months = [...new Set(manpower.filter((m) => active.has(keyOf(m)) && m.totalWorkers > 0).map((m) => m.month))]
    .filter((m) => m <= month)
    .sort()
  const use = months.length ? months[months.length - 1] : null
  const rows = use ? subjects.map((s) => ({ s, m: subjectManpower(s, manpower, use) })) : []
  const by = new Map<string, Workforce['byContractor'][number]>()
  let total = 0
  let illegal = 0
  let visaExpiring = 0
  let paidFees = 0
  for (const { s, m } of rows) {
    if (!m) continue
    total += m.totalWorkers
    illegal += m.illegalOrFreelance
    visaExpiring += m.visaExpiring30d
    paidFees += m.paidRecruitmentFees
    const c = by.get(s.contractor.uuid) ?? { key: s.contractor.uuid, label: s.contractor.name, total: 0, illegal: 0 }
    c.total += m.totalWorkers
    c.illegal += m.illegalOrFreelance
    by.set(s.contractor.uuid, c)
  }
  return {
    month: use,
    total,
    illegal,
    visaExpiring,
    paidFees,
    formalPct: total ? ((total - illegal) / total) * 100 : null,
    missing: subjects.filter((s) => !(subjectManpower(s, manpower, month)?.totalWorkers ?? 0)).length,
    byContractor: [...by.values()].sort((a, b) => b.total - a.total),
  }
}

/** Total workers declared per month. */
export function workersPerMonth(subjects: KpiSubject[], manpower: Manpower[], months: string[]): MonthPoint[] {
  return months.map((m) => ({
    month: m,
    values: [subjects.reduce((s, x) => s + (subjectManpower(x, manpower, m)?.totalWorkers ?? 0), 0)],
  }))
}

export interface CampsSummary {
  active: number
  ok: number
  due: number
  expired: number
  never: number
  /** Expired / never first, then due — the ones to visit. */
  toVisit: { camp: Camp; state: CampState }[]
}

export function campsSummary(camps: Camp[], inspections: Inspection[], today = localDate()): CampsSummary {
  const rows = camps.filter((c) => c.active).map((camp) => ({ camp, state: campState(camp, inspections, today) }))
  const n = (s: CampState['status']) => rows.filter((r) => r.state.status === s).length
  const rank = { never: 0, expired: 1, due: 2, ok: 3 } as const
  return {
    active: rows.length,
    ok: n('ok'),
    due: n('due'),
    expired: n('expired'),
    never: n('never'),
    toVisit: rows
      .filter((r) => r.state.status !== 'ok')
      .sort((a, b) => rank[a.state.status] - rank[b.state.status] || (b.state.daysSince ?? 1e9) - (a.state.daysSince ?? 1e9)),
  }
}

/** Inspections (by review date) per month. */
export function inspectionsPerMonth(inspections: Inspection[], months: string[]): MonthPoint[] {
  return months.map((m) => ({ month: m, values: [inspections.filter((i) => i.info?.reviewDate?.startsWith(m)).length] }))
}

/** Average audit score of inspections reviewed in the month, or null. */
export function auditAverage(inspections: Inspection[], month: string): { avg: number | null; count: number } {
  const scores = inspections
    .filter((i) => i.info?.reviewDate?.startsWith(month))
    .map((i) => inspectionPct(i))
    .filter((p): p is number => p !== null)
  return { avg: scores.length ? scores.reduce((s, p) => s + p, 0) / scores.length : null, count: scores.length }
}
