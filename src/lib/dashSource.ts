import { addDays, daysBetween, localDate } from './dates'
import { computedWeeks, weeklyTrend, type TrendPoint } from './dashboard'
import { closedIn, openOn, type ListTab } from './ticketFilter'
import type { AllData } from './kpiData'
import type { Ticket } from '../types'

// The Dashboard's Tickets view has three tabs: D&C Tickets | Cases | All.
// Every card, breakdown and line is worked out from the tab's list; only
// D&C tickets have the Closure KPI (cases are the team's own, not scored).

export type { ListTab }

/** The tab a link's ?src= opens; old links (none) stay on D&C tickets. */
export function dashSource(v: string | null): ListTab {
  if (v === 'internal' || v === 'cases') return 'internal'
  if (v === 'all') return 'all'
  return 'tickets'
}

/** The records a tab counts. */
export const ticketsOf = (d: Pick<AllData, 'tickets' | 'cases'>, tab: ListTab): Ticket[] =>
  tab === 'tickets' ? d.tickets : tab === 'internal' ? d.cases : [...d.tickets, ...d.cases]

export interface TabWords {
  /** "ticket", "case", "ticket or case" */
  one: string
  /** "tickets", "cases", "tickets and cases" */
  many: string
  /** As a title: "Tickets", "Cases", "Tickets & cases" */
  Title: string
  /** What the numbers are about: "D&C tickets", "cases", "tickets and cases" */
  label: string
}

export const WORDS: Record<ListTab, TabWords> = {
  tickets: { one: 'ticket', many: 'tickets', Title: 'Tickets', label: 'D&C tickets' },
  internal: { one: 'case', many: 'cases', Title: 'Cases', label: 'cases' },
  all: { one: 'ticket or case', many: 'tickets and cases', Title: 'Tickets & cases', label: 'tickets and cases' },
}

/**
 * Open per week. D&C: the imported weekly history, then worked out from dates
 * (as always). Cases: worked out from their dates, the last 12 weeks. All: the
 * D&C points, each plus the cases open on that date.
 */
export function openTrend(d: Pick<AllData, 'tickets' | 'cases' | 'weekly'>, tab: ListTab, today = localDate()): TrendPoint[] {
  if (tab === 'internal') return computedWeeks(d.cases, addDays(today, -7 * 12), today)
  const dnc = weeklyTrend(d.weekly, d.tickets, today)
  if (tab === 'tickets') return dnc
  return dnc.map((p) => ({ ...p, open: p.open + d.cases.filter((c) => openOn(c, p.date)).length }))
}

/** Of those closed in the month, how many took `days` or less (null when none closed). */
export function closedWithin(tickets: Ticket[], month: string, days = 30): { closed: number; fast: number; pct: number | null } {
  const closed = tickets.filter((t) => closedIn(t, month))
  const fast = closed.filter((t) => t.openedAt && daysBetween(t.openedAt, t.closedAt) <= days).length
  return { closed: closed.length, fast, pct: closed.length ? Math.round((fast / closed.length) * 100) : null }
}
