import { monthOf } from './dates'
import { lastEndedMonth } from './due'
import { KPI_PARTS, ticketKpiFacts, type TicketKpiFacts } from './kpi'
import { itemStats, subjectKpis, type AllData, type KpiItemStats } from './kpiData'
import { kpiSubjects, subjectManpower, subjectTickets, type KpiSubject } from './subjects'

// Home's KPIs section: last month's overall score and the three KPIs the app
// works out by itself (ticket closure, grievance, formal vs illegal), each with
// what it is made of. The scores are the same averages the KPI pages show
// (one per work order); the line under each adds up the tickets or workers
// behind it. Ticket closure and grievance also show the running month so far.

export type AutoKpi = 'closure' | 'grievance' | 'formal'

export interface HomeKpiRow {
  key: AutoKpi
  label: string
  /** The average over work orders, 0–100 (null = nothing to score). */
  value: number | null
  /** What it is made of: "3 of 4 closed", "3 closed · avg 19 days", "1,200 workers · 60 illegal". */
  why: string
  /** The KPI page for that month. */
  to: string
  /** The running month so far (ticket KPIs only). */
  soFar?: { value: number | null; why: string; to: string }
}

export interface HomeKpis {
  /** The month that just ended (YYYY-MM). */
  month: string
  /** The running month. */
  live: string
  overall: KpiItemStats
  overallTo: string
  rows: HomeKpiRow[]
}

const AUTO: AutoKpi[] = ['closure', 'grievance', 'formal']

const mean = (vals: (number | null)[]) => {
  const v = vals.filter((x): x is number => x !== null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

/** Each work order's ticket facts for a month (the same tickets its KPI counts). */
const factsFor = (d: AllData, subjects: KpiSubject[], month: string, today: string) =>
  subjects.map((s) => ticketKpiFacts(subjectTickets(s, d.tickets, d.workOrders), month, today))

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

function closureWhy(f: TicketKpiFacts[]): string {
  const of = sum(f.map((x) => x.during.length))
  return of ? `${sum(f.map((x) => x.closedDuring))} of ${of} closed` : 'No tickets'
}

function grievanceWhy(f: TicketKpiFacts[]): string {
  const days = f.flatMap((x) => x.days)
  return days.length ? `${days.length} closed · avg ${Math.round(sum(days) / days.length)} days` : 'No tickets closed'
}

function formalWhy(d: AllData, subjects: KpiSubject[], month: string): string {
  const rows = subjects.map((s) => subjectManpower(s, d.manpower, month)).filter((m) => !!m && m.totalWorkers > 0)
  if (!rows.length) return 'No worker count'
  const total = sum(rows.map((m) => m!.totalWorkers))
  const illegal = sum(rows.map((m) => m!.illegalOrFreelance))
  return `${total.toLocaleString('en-US')} workers · ${illegal.toLocaleString('en-US')} illegal`
}

export function homeKpis(d: AllData, today: string): HomeKpis {
  const month = lastEndedMonth(today)
  const live = monthOf(today)
  const subjects = kpiSubjects(d.contractors, d.workOrders)
  const rows = subjectKpis(d, month)
  const facts = factsFor(d, subjects, month, today)
  const liveFacts = factsFor(d, subjects, live, today)
  const label = (k: AutoKpi) => KPI_PARTS.find((p) => p.key === k)!.label
  const link = (k: string, m: string) => `/kpis/${k}?m=${m}`

  const out: HomeKpiRow[] = AUTO.map((key) => {
    if (key === 'formal') return { key, label: label(key), value: itemStats(rows, key).avg, why: formalWhy(d, subjects, month), to: link(key, month) }
    return {
      key,
      label: label(key),
      value: mean(facts.map((f) => f[key])),
      why: key === 'closure' ? closureWhy(facts) : grievanceWhy(facts),
      to: link(key, month),
      soFar: { value: mean(liveFacts.map((f) => f[key])), why: key === 'closure' ? closureWhy(liveFacts) : grievanceWhy(liveFacts), to: link(key, live) },
    }
  })
  return { month, live, overall: itemStats(rows, 'overall'), overallTo: link('overall', month), rows: out }
}
