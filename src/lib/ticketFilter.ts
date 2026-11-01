import { agingBucket, ageDays, isOpen, type AgingBucket } from './aging'
import { daysBetween, localDate, monthLabel, monthRange } from './dates'
import type { Ticket } from '../types'

// Ticket filters carried in the link (/tickets?f=all&c=…&m=…), so every number
// and bar can open the exact tickets it counted. The month rules here are the
// ones the Dashboard counts with (periodStats), so lists and numbers agree.

export type TicketTab = 'open' | 'late' | 'closed' | 'all'
/** Which tickets of the month: opened in it, closed in it, open at its end, or over 30 days at its end. */
export type TicketIn = 'opened' | 'closed' | 'openAtEnd' | 'lateAtEnd'
/** Money: still owed (open), recovered (closed), or any amount. */
export type TicketOwed = 'open' | 'paid' | 'any'

export interface TicketQuery {
  f?: TicketTab
  c?: string
  wo?: string
  m?: string
  in?: TicketIn
  issue?: string
  cat?: string
  src?: string
  age?: AgingBucket
  owed?: TicketOwed
}

/** The filter keys (everything except the tab). */
export const QUERY_KEYS = ['c', 'wo', 'm', 'in', 'issue', 'cat', 'src', 'age', 'owed'] as const
type QueryKey = (typeof QUERY_KEYS)[number]

/** Open at the end of `date`. Closed tickets without a date count as closed. */
export function openOn(t: Ticket, date: string): boolean {
  if (!t.openedAt || t.openedAt > date) return false
  if (t.status !== 'Closed') return true
  return !!t.closedAt && t.closedAt > date
}

/** The last day of the month that has happened (today for the current month). */
export const monthEnd = (month: string, today = localDate()) => {
  const end = monthRange(month).end
  return end < today ? end : today
}
export const openedIn = (t: Ticket, month: string) => {
  const r = monthRange(month)
  return t.openedAt >= r.start && t.openedAt <= r.end
}
export const closedIn = (t: Ticket, month: string) => {
  const r = monthRange(month)
  return t.status === 'Closed' && !!t.closedAt && t.closedAt >= r.start && t.closedAt <= r.end
}
export const lateOn = (t: Ticket, date: string) => openOn(t, date) && daysBetween(t.openedAt, date) > 30

const priced = (t: Ticket) => typeof t.amountOwed === 'number' && t.amountOwed > 0

export function parseTicketQuery(p: URLSearchParams): TicketQuery {
  const q: TicketQuery = {}
  const f = p.get('f')
  if (f === 'open' || f === 'late' || f === 'closed' || f === 'all') q.f = f
  for (const k of QUERY_KEYS) {
    const v = p.get(k)
    if (v) (q as Record<string, string>)[k] = v
  }
  return q
}

/** Any filter beyond the tab (shows chips and a Back button). */
export const hasQuery = (q: TicketQuery) => QUERY_KEYS.some((k) => !!q[k])

/** A link to the Tickets list with these filters; all states shown unless a tab is given. */
export function ticketLink(q: TicketQuery, from?: string): string {
  const p = new URLSearchParams()
  p.set('f', q.f ?? 'all')
  for (const k of QUERY_KEYS) if (q[k]) p.set(k, String(q[k]))
  if (from) p.set('from', from)
  return `/tickets?${p.toString()}`
}

export function filterTickets(tickets: Ticket[], q: TicketQuery, today = localDate()): Ticket[] {
  const end = q.m ? monthEnd(q.m, today) : today
  const scope: TicketIn | undefined = q.in ?? (q.m ? 'opened' : undefined)
  return tickets.filter((t) => {
    if (q.f === 'open' && !isOpen(t)) return false
    if (q.f === 'late' && !(isOpen(t) && ageDays(t, today) > 30)) return false
    if (q.f === 'closed' && isOpen(t)) return false
    if (q.c !== undefined && (t.contractorUuid || 'none') !== q.c) return false
    if (q.wo !== undefined && t.workOrderUuid !== q.wo) return false
    if (scope === 'opened' && q.m && !openedIn(t, q.m)) return false
    if (scope === 'closed' && q.m && !closedIn(t, q.m)) return false
    if (scope === 'openAtEnd' && !openOn(t, end)) return false
    if (scope === 'lateAtEnd' && !lateOn(t, end)) return false
    if (q.issue !== undefined && (t.issue || '—') !== q.issue) return false
    if (q.cat !== undefined && (t.category || '—') !== q.cat) return false
    if (q.src !== undefined && (t.source || '—') !== q.src) return false
    if (q.age !== undefined && !(isOpen(t) && agingBucket(ageDays(t, today)) === q.age)) return false
    if (q.owed === 'open' && !(priced(t) && isOpen(t))) return false
    if (q.owed === 'paid' && !(priced(t) && !isOpen(t))) return false
    if (q.owed === 'any' && !priced(t)) return false
    return true
  })
}

const AGE_LABEL: Record<AgingBucket, string> = {
  '0-10': '0–10 days',
  '11-30': '11–30 days',
  '31-60': '31–60 days',
  '61-90': '61–90 days',
  '90+': 'Over 90 days',
}
const IN_LABEL: Record<TicketIn, string> = {
  opened: 'Opened in',
  closed: 'Closed in',
  openAtEnd: 'Open at end of',
  lateAtEnd: 'Over 30 days at end of',
}
const OWED_LABEL: Record<TicketOwed, string> = { open: 'Money owed', paid: 'Money recovered', any: 'With money' }

export interface QueryChip {
  /** The link keys this chip removes. */
  keys: QueryKey[]
  label: string
}

/** One chip per filter, in a fixed order; the month chip carries its scope. */
export function queryChips(q: TicketQuery, names: { contractor: (uuid: string) => string; workOrder: (uuid: string) => string }): QueryChip[] {
  const chips: QueryChip[] = []
  if (q.c) chips.push({ keys: ['c'], label: q.c === 'none' ? 'No contractor' : names.contractor(q.c) })
  if (q.wo) chips.push({ keys: ['wo'], label: names.workOrder(q.wo) })
  if (q.m) chips.push({ keys: ['m', 'in'], label: `${IN_LABEL[q.in ?? 'opened']} ${monthLabel(q.m)}` })
  else if (q.in === 'openAtEnd') chips.push({ keys: ['in'], label: 'Open now' })
  else if (q.in === 'lateAtEnd') chips.push({ keys: ['in'], label: 'Over 30 days now' })
  if (q.issue) chips.push({ keys: ['issue'], label: q.issue })
  if (q.cat) chips.push({ keys: ['cat'], label: q.cat })
  if (q.src) chips.push({ keys: ['src'], label: q.src })
  if (q.age) chips.push({ keys: ['age'], label: AGE_LABEL[q.age] })
  if (q.owed) chips.push({ keys: ['owed'], label: OWED_LABEL[q.owed] })
  return chips
}
