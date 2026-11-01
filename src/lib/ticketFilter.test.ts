import { describe, expect, it } from 'vitest'
import { filterTickets, hasQuery, parseTicketQuery, queryChips, ticketLink } from './ticketFilter'
import { periodStats } from './dashboard'
import type { Ticket } from '../types'

const T = (p: Partial<Ticket>): Ticket =>
  ({ uuid: Math.random().toString(36), ticketNo: '', contractorUuid: 'c1', workOrderUuid: '', issue: 'Salary delay', category: 'Payroll', source: 'System', status: 'Open', openedAt: '2026-10-05', closedAt: '', workers: 1, amountOwed: null, ...p }) as Ticket

const today = '2026-11-01'
const tickets: Ticket[] = [
  T({ openedAt: '2026-09-20' }), // open, late at end of Oct (41 days)
  T({ openedAt: '2026-10-05', status: 'Closed', closedAt: '2026-10-20', amountOwed: 900 }),
  T({ openedAt: '2026-10-10', contractorUuid: 'c2', issue: '' }),
  T({ openedAt: '2026-10-28', amountOwed: 4500 }),
  T({ openedAt: '2026-09-01', status: 'Closed', closedAt: '2026-10-02', source: 'Internal' }),
  T({ openedAt: '2026-11-01' }),
]

describe('Ticket filters in the link', () => {
  it('a list opened from a Dashboard number has exactly the tickets it counted', () => {
    const s = periodStats(tickets, '2026-10', new Map(), today)
    const n = (q: Parameters<typeof filterTickets>[1]) => filterTickets(tickets, q, today).length
    expect(n({ m: '2026-10', in: 'opened' })).toBe(s.opened.length)
    expect(n({ m: '2026-10', in: 'closed' })).toBe(s.closed.length)
    expect(n({ m: '2026-10', in: 'openAtEnd' })).toBe(s.openAtEnd)
    expect(n({ m: '2026-10', in: 'lateAtEnd' })).toBe(s.over30AtEnd)
  })
  it('filters by contractor, issue (blank as —), source, age and money', () => {
    expect(filterTickets(tickets, { c: 'c2' }, today)).toHaveLength(1)
    expect(filterTickets(tickets, { issue: '—' }, today)).toHaveLength(1)
    expect(filterTickets(tickets, { src: 'Internal' }, today)).toHaveLength(1)
    expect(filterTickets(tickets, { age: '31-60' }, today)).toHaveLength(1)
    expect(filterTickets(tickets, { owed: 'open' }, today)).toHaveLength(1)
    expect(filterTickets(tickets, { owed: 'paid' }, today)).toHaveLength(1)
  })
  it('the link always shows all states and survives a round trip', () => {
    const link = ticketLink({ c: 'c1', m: '2026-10', in: 'closed' })
    expect(link.startsWith('/tickets?f=all&')).toBe(true)
    const q = parseTicketQuery(new URLSearchParams(link.split('?')[1]))
    expect(q).toEqual({ f: 'all', c: 'c1', m: '2026-10', in: 'closed' })
    expect(hasQuery(q)).toBe(true)
    expect(hasQuery(parseTicketQuery(new URLSearchParams('f=late')))).toBe(false)
  })
  it('chips say what the list was opened with', () => {
    const chips = queryChips(
      { c: 'c1', m: '2026-10', in: 'opened', issue: 'Food', age: '11-30', owed: 'open' },
      { contractor: () => 'RPCO', workOrder: () => 'WO 882' },
    )
    expect(chips.map((c) => c.label)).toEqual(['RPCO', 'Opened in Oct 2026', 'Food', '11–30 days', 'Money owed'])
  })
})
