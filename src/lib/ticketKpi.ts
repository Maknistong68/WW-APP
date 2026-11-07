import { isCase } from './cases'
import { dayMonth, daysBetween, monthName, monthOf, monthRange } from './dates'
import { closedInMonth, grievanceTier, kpiStatus, pct, ticketKpiFacts } from './kpi'
import type { AllData } from './kpiData'
import { kpiSubjects, subjectTickets } from './subjects'
import { kpiTone, type Tone } from './tone'
import { contractorSubjects } from './trends'
import type { Contractor, Ticket } from '../types'

// What one ticket counts toward: the two KPIs worked out from tickets.
// Grievance scores the average days to close of the tickets closed in a month
// (in steps); ticket closure is the tickets closed in a month out of those
// open at any point in it. The sums use the same tickets the contractor's
// KPI counts (its work order's D&C tickets), so they match the KPI pages.

export interface TicketKpiRow {
  key: 'grievance' | 'closure'
  label: string
  /** The score this row is about (0–100), null = not scored. */
  value: number | null
  /** The ticket's own part, or the month's sum. */
  line: string
  /** The rest of the sum, or what happens next. */
  sub: string
  /** The contractor's KPI page for that month, with the tickets behind it. */
  to: string
}

export type TicketKpi = { kind: 'counted'; rows: TicketKpiRow[] } | { kind: 'not'; why: string }

export const GRIEVANCE_STEPS = 'Up to 10 days 100% · 15 days 90% · 20 days 80% · 30 days 70% · over 30 days 0%'

/** "October" for an ended month, "November so far" for the running one. */
const monthWord = (month: string, today: string) => (today <= monthRange(month).end ? `${monthName(month)} so far` : monthName(month))

export function ticketKpiRows(t: Ticket, d: AllData, today: string): TicketKpi {
  if (isCase(t)) return { kind: 'not', why: 'Cases don’t count toward the ticket KPIs.' }
  const subjects = kpiSubjects(d.contractors, d.workOrders)
  const subject = subjects.find((s) => subjectTickets(s, [t], d.workOrders).length > 0)
  if (!subject) {
    const followed = subjects.some((s) => s.contractor.uuid === t.contractorUuid)
    return { kind: 'not', why: followed ? 'Not counted yet: give it a work order.' : 'Not counted: this contractor isn’t followed.' }
  }
  // the work order's tickets, with this one as it is now
  const tickets = subjectTickets(subject, [...d.tickets.filter((x) => x.uuid !== t.uuid), t], d.workOrders)
  const wo = subject.workOrder?.uuid
  const link = (key: string, month: string) => `/contractors/${subject.contractor.uuid}/kpi/${key}?m=${month}${wo ? `&wo=${wo}` : ''}`
  const placed = t.status !== 'Closed' || !!t.closedAt
  const month = t.status === 'Closed' && t.closedAt ? monthOf(t.closedAt) : monthOf(today)
  const f = ticketKpiFacts(tickets, month, today)
  const when = monthWord(month, today)

  let grievance: TicketKpiRow
  if (!placed) {
    grievance = { key: 'grievance', label: 'Grievance', value: null, line: 'Closed with no date, so it isn’t counted', sub: GRIEVANCE_STEPS, to: link('grievance', month) }
  } else if (t.status === 'Closed') {
    const days = daysBetween(t.openedAt, t.closedAt)
    const step = grievanceTier(days)
    grievance = {
      key: 'grievance',
      label: 'Grievance',
      value: step,
      line: `Closed in ${days} day${days === 1 ? '' : 's'} → ${step}%`,
      sub: `${when}: ${f.closed.length} closed, avg ${Math.round(f.avgDays ?? days)} days → ${pct(f.grievance)}`,
      to: link('grievance', month),
    }
  } else {
    const days = daysBetween(t.openedAt, today)
    const step = grievanceTier(days)
    grievance = { key: 'grievance', label: 'Grievance', value: step, line: `Open ${days} days: closing today scores ${step}%`, sub: GRIEVANCE_STEPS, to: link('grievance', month) }
  }

  const of = f.during.length
  const closure: TicketKpiRow = {
    key: 'closure',
    label: 'Ticket closure',
    value: placed ? f.closure : null,
    line: !placed
      ? 'Closed with no date, so it isn’t counted'
      : `${when}: ${f.closedDuring} of ${of} closed${f.closure === null ? ' (not scored yet)' : ` = ${pct(f.closure)}`}`,
    sub: !placed ? '' : t.status === 'Closed' ? `This one closed on ${dayMonth(t.closedAt)}` : 'Still open: it counts as not closed until it is',
    to: link('closure', month),
  }
  return { kind: 'counted', rows: [grievance, closure] }
}

// ---- The tickets behind a contractor's ticket KPI for one month --------------------------

export interface BreakdownTicket {
  uuid: string
  ticketNo: string
  /** "Opened 20 Sep · closed 9 Oct" */
  dates: string
  /** Grievance: "19 days → 80%". Closure: "Closed 9 Oct", "Still open", "Closed later, 3 Nov". */
  note: string
  tone: Tone
}

export interface BreakdownPart {
  /** "WO 882", or the contractor's name when it has no work orders. */
  label: string
  value: number | null
  tickets: BreakdownTicket[]
  /** "(19 + 7 + 5) ÷ 3 = 10.3 days → 90%", "3 of 5 closed = 60%". */
  sum: string
}

export interface Breakdown {
  parts: BreakdownPart[]
  /** With two or more work orders: how they average into the contractor's score. */
  total: string | null
  value: number | null
}

/** Write each day count up to this many tickets; past it, just the total. */
const SPELL_OUT = 6

const num = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))

/**
 * What a contractor's grievance or closure score for a month is made of: per
 * work order (all of them, or the one picked), the tickets counted and the sum,
 * then how the work orders average into the contractor's score.
 */
export function ticketKpiBreakdown(d: AllData, c: Contractor, key: 'grievance' | 'closure', month: string, wo: string | undefined, today: string): Breakdown {
  const name = monthName(month)
  const parts = contractorSubjects(d, c)
    .filter((s) => !wo || s.workOrder?.uuid === wo)
    .map((s): BreakdownPart => {
      const f = ticketKpiFacts(subjectTickets(s, d.tickets, d.workOrders), month, today)
      const label = s.workOrder ? `WO ${s.workOrder.number}` : c.name
      const opened = (t: Ticket) => `Opened ${dayMonth(t.openedAt)}`
      if (key === 'grievance') {
        const rows = f.closed.map((t, i) => ({ t, days: f.days[i] })).sort((a, b) => a.t.closedAt.localeCompare(b.t.closedAt))
        const tickets = rows.map(({ t, days }) => {
          const step = grievanceTier(days)
          return { uuid: t.uuid, ticketNo: t.ticketNo, dates: `${opened(t)} · closed ${dayMonth(t.closedAt)}`, note: `${days} days → ${step}%`, tone: kpiTone(kpiStatus(step)) }
        })
        const days = rows.map((r) => r.days)
        const total = days.reduce((a, b) => a + b, 0)
        const sum = !days.length
          ? `No tickets closed in ${name}`
          : days.length === 1
            ? `${days[0]} days → ${pct(f.grievance)}`
            : `${days.length <= SPELL_OUT ? `(${days.join(' + ')})` : `${total} days`} ÷ ${days.length} = ${num(Math.round((total / days.length) * 10) / 10)} days → ${pct(f.grievance)}`
        return { label, value: f.grievance, tickets, sum }
      }
      const { end } = monthRange(month)
      const tickets = [...f.during]
        .sort((a, b) => a.openedAt.localeCompare(b.openedAt))
        .map((t) => {
          const here = closedInMonth(t, month)
          const note = here ? `Closed ${dayMonth(t.closedAt)}` : t.status === 'Closed' && t.closedAt > end ? `Closed later, ${dayMonth(t.closedAt)}` : 'Still open'
          return { uuid: t.uuid, ticketNo: t.ticketNo, dates: t.closedAt ? `${opened(t)} · closed ${dayMonth(t.closedAt)}` : opened(t), note, tone: (here ? 'good' : 'bad') as Tone }
        })
      const sum = !f.during.length
        ? `No tickets open in ${name}`
        : `${f.closedDuring} of ${f.during.length} closed${f.closure === null ? ' (not scored yet)' : ` = ${pct(f.closure)}`}`
      return { label, value: f.closure, tickets, sum }
    })
  const vals = parts.map((p) => p.value).filter((v): v is number => v !== null)
  const value = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  const total = parts.length > 1 && vals.length ? `Average of the work orders: (${vals.map((v) => Math.round(v)).join(' + ')}) ÷ ${vals.length} = ${pct(value)}` : null
  return { parts, total, value }
}
