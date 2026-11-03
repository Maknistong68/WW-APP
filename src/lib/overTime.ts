import { auditAverage, inspectionsPerMonth, lastMonths, recoveredPerMonth, ticketsPerMonth, workersPerMonth, type DashView } from './dashboard'
import { WORDS, openTrend, ticketsOf } from './dashSource'
import type { ListTab } from './ticketFilter'
import { localDate, monthLabel } from './dates'
import { itemStats, subjectKpis, type AllData } from './kpiData'
import { docsSettled, kpiSubjects } from './subjects'
import type { Tone } from './tone'

// The Dashboard's "Over time" card: one line chart, and chips that pick the series.

export interface OverTimeChip {
  key: string
  label: string
}

export const OVER_TIME_CHIPS: Record<DashView, OverTimeChip[]> = {
  tickets: [
    { key: 'open', label: 'Open' },
    { key: 'opened', label: 'Opened' },
    { key: 'closed', label: 'Closed' },
    { key: 'recovered', label: 'Recovered' },
  ],
  kpis: [
    { key: 'overall', label: 'Overall KPI' },
    { key: 'workers', label: 'Workers' },
    { key: 'submissions', label: 'Documents' },
    { key: 'audit', label: 'Audit score' },
  ],
  accommodation: [
    { key: 'inspections', label: 'Inspections' },
    { key: 'score', label: 'Avg score' },
  ],
}

/** The chip a link names, or the view's first one. */
export const overTimeChip = (view: DashView, key: string | null): string =>
  OVER_TIME_CHIPS[view].some((c) => c.key === key) ? (key as string) : OVER_TIME_CHIPS[view][0].key

export interface OverTimePoint {
  /** YYYY-MM-DD (the 1st for a month). */
  date: string
  /** null = no data: the line breaks there. */
  value: number | null
}

export interface OverTimeSeries {
  mode: 'week' | 'month'
  data: OverTimePoint[]
  /** Written after the value in the callout ("open", "%", "SAR"). */
  unit: string
  /** Money: shown as SAR. */
  sar?: boolean
  /** A fixed axis top (100 for percentages). */
  max?: number
  guides?: { value: number; tone: Tone }[]
  /** Points coloured by KPI status. */
  status?: boolean
  /** What a tapped month opens: its tickets, or that month on the Dashboard. */
  open?: 'opened' | 'closed' | 'paid' | 'month'
  /** The line under the chips. */
  sub: string
}

const TICKET_MONTHS = 12
const KPI_MONTHS = 6
const KPI_GUIDES: { value: number; tone: Tone }[] = [
  { value: 90, tone: 'good' },
  { value: 70, tone: 'bad' },
]

const monthly = (months: string[], values: (number | null)[]): OverTimePoint[] => months.map((m, i) => ({ date: `${m}-01`, value: values[i] }))
const to = (months: string[]) => `${months.length} months to ${monthLabel(months[months.length - 1])}`
const round = (v: number | null) => (v === null ? null : Math.round(v))

/** One series for the chosen chip. */
export function overTimeSeries(d: AllData, view: DashView, chip: string, kpiMonth: string, today = localDate(), src: ListTab = 'tickets'): OverTimeSeries {
  const months12 = lastMonths(kpiMonth, TICKET_MONTHS)
  const months6 = lastMonths(kpiMonth, KPI_MONTHS)
  const subjects = kpiSubjects(d.contractors, d.workOrders)
  const perMonth = (months: string[], f: (m: string) => number | null) => monthly(months, months.map(f))
  const scorePerMonth = (months: string[]) => perMonth(months, (m) => round(auditAverage(d.inspections, m).avg))

  if (view === 'tickets') {
    // the tab's list: D&C tickets, cases, or both
    const list = ticketsOf(d, src)
    const w = WORDS[src]
    const Label = w.label.charAt(0).toUpperCase() + w.label.slice(1)
    if (chip === 'open') {
      const trend = openTrend(d, src, today)
      return { mode: 'week', data: trend.map((p) => ({ date: p.date, value: p.open })), unit: 'open', sub: `${Label} open · per week · ${trend.length} weeks` }
    }
    if (chip === 'recovered') {
      const rows = recoveredPerMonth(list, months12)
      return { mode: 'month', data: monthly(months12, rows.map((r) => r.values[0])), unit: 'SAR', sar: true, open: 'paid', sub: `SAR on ${w.many} closed · ${to(months12)}` }
    }
    const rows = ticketsPerMonth(list, months12)
    const i = chip === 'closed' ? 1 : 0
    return {
      mode: 'month',
      data: monthly(months12, rows.map((r) => r.values[i])),
      unit: chip === 'closed' ? 'closed' : 'opened',
      open: chip === 'closed' ? 'closed' : 'opened',
      sub: `${w.Title} ${chip === 'closed' ? 'closed' : 'opened'} · ${to(months12)}`,
    }
  }

  if (view === 'kpis') {
    if (chip === 'workers') {
      const rows = workersPerMonth(subjects, d.manpower, months6)
      return { mode: 'month', data: monthly(months6, rows.map((r) => r.values[0] || null)), unit: 'workers', open: 'month', sub: `Workers declared · ${to(months6)}` }
    }
    if (chip === 'submissions') {
      const data = perMonth(months6, (m) =>
        subjects.length ? Math.round((subjects.filter((s) => docsSettled(s, d.kpis, m)).length / subjects.length) * 100) : null,
      )
      return { mode: 'month', data, unit: '%', max: 100, open: 'month', sub: `Work orders with every document in · ${to(months6)}` }
    }
    if (chip === 'audit') {
      return { mode: 'month', data: scorePerMonth(months6), unit: '%', max: 100, guides: KPI_GUIDES, status: true, open: 'month', sub: `Average inspection score · ${to(months6)}` }
    }
    const data = perMonth(months6, (m) => round(itemStats(subjectKpis(d, m), 'overall').avg))
    return { mode: 'month', data, unit: '%', max: 100, guides: KPI_GUIDES, status: true, open: 'month', sub: `Average overall KPI · ${to(months6)}` }
  }

  if (chip === 'score') {
    return { mode: 'month', data: scorePerMonth(months6), unit: '%', max: 100, guides: KPI_GUIDES, status: true, open: 'month', sub: `Average inspection score · ${to(months6)}` }
  }
  const rows = inspectionsPerMonth(d.inspections, months6)
  return { mode: 'month', data: monthly(months6, rows.map((r) => r.values[0])), unit: 'inspections', open: 'month', sub: `Inspections · ${to(months6)}` }
}
