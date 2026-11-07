import { describe, expect, it } from 'vitest'
import { ticketKpiBreakdown, ticketKpiRows } from './ticketKpi'
import type { AllData } from './kpiData'
import type { Contractor, Ticket, WorkOrder } from '../types'

const c1 = { uuid: 'c1', name: 'RPCO', active: true, aliases: [] } as unknown as Contractor
const c2 = { uuid: 'c2', name: 'Off', active: false, aliases: [] } as unknown as Contractor
const wo = (uuid: string, contractorUuid = 'c1') => ({ uuid, contractorUuid, number: uuid, label: '', active: true }) as WorkOrder
const tk = (uuid: string, openedAt: string, closedAt = '', p: Partial<Ticket> = {}): Ticket =>
  ({ uuid, ticketNo: uuid, contractorUuid: 'c1', workOrderUuid: 'w1', issue: '', source: 'System', status: closedAt ? 'Closed' : 'Open', openedAt, closedAt, workers: 1, parentUuid: '', ...p }) as Ticket

const data = (tickets: Ticket[], workOrders = [wo('w1')]): AllData => ({
  loaded: true,
  contractors: [c1, c2],
  byUuid: new Map([
    [c1.uuid, c1],
    [c2.uuid, c2],
  ]),
  workOrders,
  woByUuid: new Map(workOrders.map((w) => [w.uuid, w])),
  camps: [],
  tickets,
  cases: [],
  kpis: [],
  manpower: [],
  weekly: [],
  inspections: [],
})

const today = '2026-11-07'
const october = [
  tk('a', '2026-09-20', '2026-10-09'), // 19 days
  tk('b', '2026-10-03', '2026-10-10'), // 7 days
  tk('c', '2026-09-01'), // still open (67 days on 7 Nov)
  tk('d', '2026-10-20', '2026-10-25'), // 5 days
]

describe('A ticket: what it counts toward', () => {
  it('a closed ticket: its own days and step, and its month’s grievance and closure', () => {
    const r = ticketKpiRows(october[0], data(october), today)
    expect(r.kind).toBe('counted')
    if (r.kind !== 'counted') return
    const [g, c] = r.rows
    expect(g).toMatchObject({ key: 'grievance', label: 'Grievance', value: 80, line: 'Closed in 19 days → 80%' })
    // (19 + 7 + 5) / 3 = 10.3 days → 90
    expect(g.sub).toBe('October: 3 closed, avg 10 days → 90%')
    expect(g.to).toBe('/contractors/c1/kpi/grievance?m=2026-10&wo=w1')
    // a, b, d closed; c open all month → 3 of 4
    expect(c).toMatchObject({ key: 'closure', label: 'Ticket closure', value: 75, line: 'October: 3 of 4 closed = 75%' })
    expect(c.sub).toBe('This one closed on 9 Oct')
    expect(c.to).toBe('/contractors/c1/kpi/closure?m=2026-10&wo=w1')
  })

  it('an open ticket: what closing it today would score, and this month so far', () => {
    const r = ticketKpiRows(october[2], data(october), today)
    if (r.kind !== 'counted') throw new Error('expected counted')
    const [g, c] = r.rows
    expect(g).toMatchObject({ value: 0, line: 'Open 67 days: closing today scores 0%' })
    expect(g.sub).toBe('Up to 10 days 100% · 15 days 90% · 20 days 80% · 30 days 70% · over 30 days 0%')
    // November so far: only c is open in it, nothing closed yet → not scored yet
    expect(c).toMatchObject({ value: null, line: 'November so far: 0 of 1 closed (not scored yet)' })
    expect(c.sub).toBe('Still open: it counts as not closed until it is')
  })

  it('the step changes at 10, 15, 20 and 30 days', () => {
    const at = (days: number) => {
      const open = new Date(Date.UTC(2026, 9, 31 - days)).toISOString().slice(0, 10)
      const r = ticketKpiRows(tk('x', open, '2026-10-31'), data([tk('x', open, '2026-10-31')]), today)
      return r.kind === 'counted' ? r.rows[0].value : null
    }
    expect([10, 11, 15, 16, 20, 21, 30, 31].map(at)).toEqual([100, 90, 90, 80, 80, 70, 70, 0])
  })

  it('a closed ticket with no closing date can’t be placed in a month', () => {
    const t = { ...tk('z', '2026-09-01'), status: 'Closed' as const }
    const r = ticketKpiRows(t, data([t]), today)
    if (r.kind !== 'counted') throw new Error('expected counted')
    expect(r.rows[0]).toMatchObject({ value: null, line: 'Closed with no date, so it isn’t counted' })
  })

  it('says why a ticket isn’t counted', () => {
    expect(ticketKpiRows(tk('p', '2026-10-01', '', { source: 'Internal' }), data([]), today)).toEqual({ kind: 'not', why: 'Cases don’t count toward the ticket KPIs.' })
    expect(ticketKpiRows(tk('q', '2026-10-01', '', { contractorUuid: 'c2', workOrderUuid: '' }), data([], [wo('w1'), wo('w9', 'c2')]), today)).toEqual({
      kind: 'not',
      why: 'Not counted: this contractor isn’t followed.',
    })
    const two = [wo('w1'), wo('w2')]
    expect(ticketKpiRows(tk('r', '2026-10-01', '', { workOrderUuid: '' }), data([], two), today)).toEqual({
      kind: 'not',
      why: 'Not counted yet: give it a work order.',
    })
  })
})

describe('The tickets behind a contractor’s ticket KPIs', () => {
  it('grievance: each closed ticket, its days and step, and the sum', () => {
    const b = ticketKpiBreakdown(data(october), c1, 'grievance', '2026-10', undefined, today)
    expect(b.parts).toHaveLength(1)
    const p = b.parts[0]
    expect(p.label).toBe('WO w1')
    expect(p.tickets.map((t) => [t.ticketNo, t.dates, t.note, t.tone])).toEqual([
      ['a', 'Opened 20 Sep · closed 9 Oct', '19 days → 80%', 'warn'],
      ['b', 'Opened 3 Oct · closed 10 Oct', '7 days → 100%', 'good'],
      ['d', 'Opened 20 Oct · closed 25 Oct', '5 days → 100%', 'good'],
    ])
    expect(p.sum).toBe('(19 + 7 + 5) ÷ 3 = 10.3 days → 90%')
    expect(p.value).toBe(90)
    expect(b.total).toBeNull()
  })

  it('closure: every ticket open during the month, closed in it or not, and the sum', () => {
    const late = tk('e', '2026-10-28', '2026-11-03')
    const b = ticketKpiBreakdown(data([...october, late]), c1, 'closure', '2026-10', undefined, today)
    const p = b.parts[0]
    expect(p.tickets.map((t) => [t.ticketNo, t.note, t.tone])).toEqual([
      ['c', 'Still open', 'bad'],
      ['a', 'Closed 9 Oct', 'good'],
      ['b', 'Closed 10 Oct', 'good'],
      ['d', 'Closed 25 Oct', 'good'],
      ['e', 'Closed later, 3 Nov', 'bad'],
    ])
    expect(p.sum).toBe('3 of 5 closed = 60%')
  })

  it('a contractor with two work orders: one part each, and the average of them', () => {
    const two = [wo('w1'), wo('w2')]
    const tickets = [...october, tk('f', '2026-10-01', '2026-10-31', { workOrderUuid: 'w2' })]
    const b = ticketKpiBreakdown(data(tickets, two), c1, 'grievance', '2026-10', undefined, today)
    expect(b.parts.map((p) => [p.label, p.value])).toEqual([
      ['WO w1', 90],
      ['WO w2', 70],
    ])
    expect(b.total).toBe('Average of the work orders: (90 + 70) ÷ 2 = 80%')
    // one closed ticket: just its days
    expect(b.parts[1].sum).toBe('30 days → 70%')
    expect(b.value).toBe(80)
    // one work order picked: just that one
    expect(ticketKpiBreakdown(data(tickets, two), c1, 'grievance', '2026-10', 'w2', today).parts.map((p) => p.label)).toEqual(['WO w2'])
  })

  it('a long list adds up the days instead of writing each one', () => {
    const many = Array.from({ length: 8 }, (_, i) => tk(`m${i}`, '2026-10-01', '2026-10-05'))
    expect(ticketKpiBreakdown(data(many), c1, 'grievance', '2026-10', undefined, today).parts[0].sum).toBe('32 days ÷ 8 = 4 days → 100%')
  })

  it('says so when there is nothing to count', () => {
    const p = ticketKpiBreakdown(data([]), c1, 'grievance', '2026-10', undefined, today).parts[0]
    expect(p.tickets).toEqual([])
    expect(p.sum).toBe('No tickets closed in October')
    expect(ticketKpiBreakdown(data([]), c1, 'closure', '2026-10', undefined, today).parts[0].sum).toBe('No tickets open in October')
  })
})
