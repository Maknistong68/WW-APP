import { describe, expect, it } from 'vitest'
import { missingSubmissions, openOn, overdueTickets, periodStats, weeklyTrend } from './dashboard'
import type { Contractor, KpiMonth, Ticket } from '../types'

const tk = (p: Partial<Ticket>): Ticket => ({
  uuid: Math.random().toString(),
  updatedAt: '',
  source: '',
  ticketNo: '',
  channel: '',
  contractorUuid: 'a',
  subcontractor: '',
  category: '',
  issue: 'Final salary',
  priority: 2,
  severity: '',
  workers: 2,
  violations: 1,
  assignedTo: '',
  status: 'Open',
  openedAt: '2026-10-01',
  closedAt: '',
  contractorAction: '',
  wwAction: '',
  notes: '',
  ...p,
})

describe('dashboard', () => {
  it('openOn: closed without date counts as closed', () => {
    expect(openOn(tk({}), '2026-10-05')).toBe(true)
    expect(openOn(tk({ status: 'Closed', closedAt: '2026-10-10' }), '2026-10-05')).toBe(true)
    expect(openOn(tk({ status: 'Closed', closedAt: '2026-10-10' }), '2026-10-10')).toBe(false)
    expect(openOn(tk({ status: 'Closed' }), '2026-10-05')).toBe(false)
  })
  it('weekly trend continues imported weeks with computed ones', () => {
    const pts = weeklyTrend(
      [{ uuid: 'w', updatedAt: '', weekEnding: '2026-10-11', openTickets: 9 }],
      [tk({}), tk({ source: 'Internal' })],
      '2026-10-27',
    )
    expect(pts.map((p) => [p.date, p.open, p.imported])).toEqual([
      ['2026-10-11', 9, true],
      ['2026-10-18', 1, false],
      ['2026-10-25', 1, false],
    ])
  })
  it('period stats', () => {
    const c = new Map<string, Contractor>([['a', { name: 'A' } as Contractor]])
    const s = periodStats(
      [tk({}), tk({ openedAt: '2026-09-01', status: 'Closed', closedAt: '2026-10-11' }), tk({ openedAt: '2026-08-01' })],
      '2026-10',
      c,
      '2026-10-31',
    )
    expect(s.opened.length).toBe(1)
    expect(s.closed.length).toBe(1)
    expect(s.openAtEnd).toBe(2)
    expect(s.over30AtEnd).toBe(1)
    expect(s.avgDaysToClose).toBe(40)
    expect(s.byContractor[0]).toMatchObject({ label: 'A', count: 1, workers: 2 })
  })
  it('missing submissions and overdue list', () => {
    const cs = [{ uuid: 'a', active: true }, { uuid: 'b', active: true }, { uuid: 'c', active: false }] as Contractor[]
    const k = [{ contractorUuid: 'a', month: '2026-10', wps: true, manpowerDecl: true, salaryDecl: true }] as KpiMonth[]
    expect(missingSubmissions(cs, k, '2026-10').map((c) => c.uuid)).toEqual(['b'])
    const late = overdueTickets([tk({ openedAt: '2026-09-01' }), tk({ openedAt: '2026-08-01' }), tk({})], '2026-10-31')
    expect(late.map((t) => t.openedAt)).toEqual(['2026-08-01', '2026-09-01'])
  })
})
