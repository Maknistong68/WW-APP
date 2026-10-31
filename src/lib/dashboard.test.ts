import { describe, expect, it } from 'vitest'
import { missingSubmissions, openOn, overdueTickets, periodStats, weeklyTrend } from './dashboard'
import { kpiSubjects, subjectTickets } from './subjects'
import type { Contractor, KpiMonth, Ticket, WorkOrder } from '../types'

const tk = (p: Partial<Ticket>): Ticket => ({
  uuid: Math.random().toString(),
  updatedAt: '',
  source: 'System',
  ticketNo: '',
  channel: '',
  contractorUuid: 'a',
  workOrderUuid: '',
  subcontractor: '',
  category: '',
  issue: 'Final salary',
  priority: 2,
  severity: '',
  workers: 2,
  violations: 1,
  amountOwed: null,
  parentUuid: '',
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
    const cs = [
      { uuid: 'a', name: 'A', active: true },
      { uuid: 'b', name: 'B', active: true },
      { uuid: 'c', name: 'C', active: false },
    ] as Contractor[]
    const wos = [
      { uuid: 'w1', contractorUuid: 'b', number: '882', active: true },
      { uuid: 'w2', contractorUuid: 'b', number: '823', active: false },
    ] as WorkOrder[]
    const k = [
      { contractorUuid: 'a', workOrderUuid: '', month: '2026-10', wps: true, manpowerDecl: true, salaryDecl: true },
      { contractorUuid: 'b', workOrderUuid: 'w1', month: '2026-10', wps: true, manpowerDecl: false, salaryDecl: true },
    ] as KpiMonth[]
    const subjects = kpiSubjects(cs, wos)
    expect(subjects.map((s) => s.label)).toEqual(['A', 'B · WO 882'])
    expect(missingSubmissions(subjects, k, '2026-10').map((s) => s.key)).toEqual(['w1'])
    const late = overdueTickets([tk({ openedAt: '2026-09-01' }), tk({ openedAt: '2026-08-01' }), tk({})], '2026-10-31')
    expect(late.map((t) => t.openedAt)).toEqual(['2026-08-01', '2026-09-01'])
  })
})

describe('work-order subjects', () => {
  it('contractor-level tickets count for a single work order only', () => {
    const c = { uuid: 'c', name: 'C', active: true } as Contractor
    const one = [{ uuid: 'w1', contractorUuid: 'c', number: '1', active: true }] as WorkOrder[]
    const two = [...one, { uuid: 'w2', contractorUuid: 'c', number: '2', active: true }] as WorkOrder[]
    const ts = [tk({ contractorUuid: 'c' }), tk({ contractorUuid: 'c', workOrderUuid: 'w1' }), tk({ contractorUuid: 'c', workOrderUuid: 'w2' })]
    const s1 = kpiSubjects([c], one)[0]
    expect(subjectTickets(s1, ts, one)).toHaveLength(2)
    const s2 = kpiSubjects([c], two)[0]
    expect(subjectTickets(s2, ts, two)).toHaveLength(1)
  })
})
