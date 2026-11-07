import { describe, expect, it } from 'vitest'
import { homeKpis } from './homeKpis'
import type { AllData } from './kpiData'
import type { Contractor, Manpower, Ticket, WorkOrder } from '../types'

const c1 = { uuid: 'c1', name: 'RPCO', active: true, aliases: [] } as unknown as Contractor
const wo = (uuid: string, number: string) => ({ uuid, contractorUuid: 'c1', number, label: '', active: true }) as WorkOrder
const tk = (uuid: string, workOrderUuid: string, openedAt: string, closedAt = ''): Ticket =>
  ({ uuid, ticketNo: uuid, contractorUuid: 'c1', workOrderUuid, issue: '', source: 'System', status: closedAt ? 'Closed' : 'Open', openedAt, closedAt, workers: 1, parentUuid: '' }) as Ticket

const data = (): AllData => {
  const workOrders = [wo('w1', '882'), wo('w2', '1134')]
  return {
    loaded: true,
    contractors: [c1],
    byUuid: new Map([[c1.uuid, c1]]),
    workOrders,
    woByUuid: new Map(workOrders.map((w) => [w.uuid, w])),
    camps: [],
    tickets: [
      tk('a', 'w1', '2026-09-20', '2026-10-09'), // 19 days
      tk('b', 'w1', '2026-10-03', '2026-10-10'), // 7 days
      tk('c', 'w1', '2026-09-01'), // still open
      tk('d', 'w2', '2026-10-01', '2026-10-31'), // 30 days
      tk('e', 'w2', '2026-11-02', '2026-11-06'), // 4 days, in November
    ],
    cases: [],
    kpis: [],
    manpower: [{ contractorUuid: 'c1', workOrderUuid: 'w1', month: '2026-10', totalWorkers: 1200, illegalOrFreelance: 60, visaExpiring30d: 0, paidRecruitmentFees: 0 }] as Manpower[],
    weekly: [],
    inspections: [],
  }
}

describe('Home KPIs: the scores worked out from the data', () => {
  const k = homeKpis(data(), '2026-11-07')

  it('shows the month that just ended, and the running one so far', () => {
    expect(k.month).toBe('2026-10')
    expect(k.live).toBe('2026-11')
  })

  it('overall: the average and the work orders on track / at risk / critical, as the KPI page counts them', () => {
    // w1: (grievance 90 + formal 95 + closure 66.7) / 3 = 83.9; w2: (grievance 70 + closure 100) / 2 = 85
    expect(k.overall.avg).toBeCloseTo(84.4, 1)
    expect([k.overall.good, k.overall.warn, k.overall.bad]).toEqual([0, 2, 0])
    expect(k.overallTo).toBe('/kpis/overall?m=2026-10')
  })

  it('ticket closure: the average score, with the tickets behind it', () => {
    const r = k.rows.find((x) => x.key === 'closure')!
    expect(r.label).toBe('Ticket closure')
    // w1 2 of 3 = 66.7, w2 1 of 1 = 100 → 83.3
    expect(r.value).toBeCloseTo(83.3, 1)
    expect(r.why).toBe('3 of 4 closed')
    expect(r.to).toBe('/kpis/closure?m=2026-10')
    // November so far: w1 has nothing closed yet (not scored), w2 closed its one
    expect(r.soFar).toEqual({ value: 100, why: '1 of 2 closed', to: '/kpis/closure?m=2026-11' })
  })

  it('grievance: the average score, with the closed tickets and their average days', () => {
    const r = k.rows.find((x) => x.key === 'grievance')!
    // w1 avg 13 days → 90, w2 30 days → 70
    expect(r.value).toBe(80)
    expect(r.why).toBe('3 closed · avg 19 days')
    expect(r.soFar).toEqual({ value: 100, why: '1 closed · avg 4 days', to: '/kpis/grievance?m=2026-11' })
  })

  it('formal vs illegal: from the month’s worker counts, no "so far"', () => {
    const r = k.rows.find((x) => x.key === 'formal')!
    expect(r.value).toBe(95)
    expect(r.why).toBe('1,200 workers · 60 illegal')
    expect(r.soFar).toBeUndefined()
  })

  it('says so when there is nothing to count', () => {
    const empty = homeKpis({ ...data(), tickets: [], manpower: [] }, '2026-11-07')
    expect(empty.rows.map((r) => [r.key, r.value, r.why])).toEqual([
      ['closure', null, 'No tickets'],
      ['grievance', null, 'No tickets closed'],
      ['formal', null, 'No worker count'],
    ])
  })
})
