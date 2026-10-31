import { ageDays, isOpen } from './aging'
import { addDays, daysBetween, localDate, monthRange } from './dates'
import { submissionsComplete } from './kpi'
import type { Contractor, KpiMonth, Ticket, WeeklyCount } from '../types'

/** Open at the end of `date`. Closed tickets without a date count as closed. */
export function openOn(t: Ticket, date: string): boolean {
  if (!t.openedAt || t.openedAt > date) return false
  if (t.status !== 'Closed') return true
  return !!t.closedAt && t.closedAt > date
}

export interface TrendPoint {
  date: string
  open: number
  imported: boolean
}

/**
 * Weekly open tickets: the imported weekly snapshots, then one point per
 * week computed from ticket dates up to today.
 */
export function weeklyTrend(weekly: WeeklyCount[], tickets: Ticket[], today = localDate()): TrendPoint[] {
  const points: TrendPoint[] = [...weekly]
    .sort((a, b) => a.weekEnding.localeCompare(b.weekEnding))
    .map((w) => ({ date: w.weekEnding, open: w.openTickets, imported: true }))
  const = tickets.filter((t) => t.source === '')
  let d = points.length ? addDays(points[points.length - 1].date, 7) : addDays(today, -7 * 12)
  while (d <= today) {
    points.push({ date: d, open: .filter((t) => openOn(t, d)).length, imported: false })
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
  const opened = tickets.filter((t) => t.openedAt >= range.start && t.openedAt <= range.end)
  const closed = tickets.filter(
    (t) => t.status === 'Closed' && t.closedAt && t.closedAt >= range.start && t.closedAt <= range.end,
  )
  const openEnd = tickets.filter((t) => openOn(t, end))
  const avg = closed.length
    ? closed.reduce((s, t) => s + daysBetween(t.openedAt, t.closedAt), 0) / closed.length
    : null
  return {
    opened,
    closed,
    openAtEnd: openEnd.length,
    over30AtEnd: openEnd.filter((t) => daysBetween(t.openedAt, end) > 30).length,
    workersOpened: opened.reduce((s, t) => s + (t.workers || 0), 0),
    avgDaysToClose: avg,
    byContractor: countBy(opened, (t) => t.contractorUuid, (k) => contractors.get(k)?.name ?? 'No contractor'),
    byIssue: countBy(opened, (t) => t.issue, (k) => k),
  }
}

/** Active contractors whose WPS / manpower / salary aren't all in for the month. */
export function missingSubmissions(contractors: Contractor[], kpis: KpiMonth[], month: string): Contractor[] {
  const done = new Set(kpis.filter((k) => k.month === month && submissionsComplete(k)).map((k) => k.contractorUuid))
  return contractors.filter((c) => c.active && !done.has(c.uuid))
}

/** Oldest open tickets past 30 days, oldest first. */
export const overdueTickets = (tickets: Ticket[], today = localDate()) =>
  tickets
    .filter((t) => isOpen(t) && ageDays(t, today) > 30)
    .sort((a, b) => ageDays(b, today) - ageDays(a, today))
