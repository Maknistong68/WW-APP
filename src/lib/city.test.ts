import { describe, expect, it } from 'vitest'
import { ageRing, buildCity, buildTimeline, coinCount, layout, timelineMonths, towerHeight } from './city'
import type { AllData } from './kpiData'
import type { Camp, Contractor, Manpower, Ticket, WorkOrder } from '../types'

const c = (uuid: string, name: string, active = true) => ({ uuid, name, active, aliases: [] }) as unknown as Contractor
const wo = (uuid: string, contractorUuid: string, number: string) => ({ uuid, contractorUuid, number, label: '', active: true }) as unknown as WorkOrder
const t = (p: Partial<Ticket>) =>
  ({ uuid: Math.random().toString(36), ticketNo: 'WWCMPL1', status: 'Open', openedAt: '2026-10-01', closedAt: '', workers: 1, amountOwed: 0, issue: 'Salary', parentUuid: '', contractorUuid: 'a', workOrderUuid: '', ...p }) as Ticket

const data = (p: Partial<AllData> = {}): AllData => {
  const contractors = [c('a', 'Alpha'), c('b', 'Beta'), c('z', 'Zeta', false)]
  const workOrders = [wo('w1', 'a', '882'), wo('w2', 'a', '883')]
  return {
    loaded: true,
    contractors,
    byUuid: new Map(contractors.map((x) => [x.uuid, x])),
    workOrders,
    woByUuid: new Map(workOrders.map((w) => [w.uuid, w])),
    camps: [],
    tickets: [],
    kpis: [],
    manpower: [],
    weekly: [],
    inspections: [],
    ...p,
  }
}

describe('Living Site city', () => {
  it('scales: taller with more workers, coins grow with SAR, tickets ring by age', () => {
    expect(towerHeight(null)).toBeLessThan(towerHeight(100))
    expect(towerHeight(2500)).toBeGreaterThan(towerHeight(400))
    expect([coinCount(0), coinCount(1000), coinCount(1_000_000)]).toEqual([0, 1, 32])
    expect(layout(Array.from({ length: 12 }, (_, i) => ({ uuid: String(i), towers: 1 })), 0.5).filter((p) => p.z === layout(Array.from({ length: 12 }, (_, i) => ({ uuid: String(i), towers: 1 })), 0.5)[0].z).length).toBeLessThan(4)
    expect(coinCount(1e12)).toBe(40)
    expect([ageRing(3), ageRing(20), ageRing(45)]).toEqual([0, 1, 2])
  })

  it('layout is a centred grid, stable for the same input', () => {
    const a = layout([{ uuid: 'a', towers: 2 }, { uuid: 'b', towers: 1 }, { uuid: 'c', towers: 5 }])
    expect(a.map((p) => p.uuid)).toEqual(['a', 'b', 'c'])
    expect(a).toEqual(layout([{ uuid: 'a', towers: 2 }, { uuid: 'b', towers: 1 }, { uuid: 'c', towers: 5 }]))
    expect(a[2].towerRows).toBe(2)
  })

  it('towers per work order, tickets on the right tower, inactive contractors only with open tickets', () => {
    const mp = [{ contractorUuid: 'a', workOrderUuid: 'w1', month: '2026-10', totalWorkers: 400, illegalOrFreelance: 3, visaExpiring30d: 1, paidRecruitmentFees: 0 }] as Manpower[]
    const city = buildCity(data({ manpower: mp, tickets: [t({ workOrderUuid: 'w2', openedAt: '2026-09-01', amountOwed: 4000 })] }), '2026-10', '2026-10-31')
    expect(city.blocks.map((b) => b.name)).toEqual(['Alpha', 'Beta'])
    expect(city.towers.filter((x) => x.contractorUuid === 'a').map((x) => x.label)).toEqual(['WO 882', 'WO 883'])
    const w1 = city.towers.find((x) => x.key === 'w1')!
    expect([w1.workers, w1.illegal, w1.floors.length]).toEqual([400, 3, 8])
    expect(city.tickets[0]).toMatchObject({ towerKey: 'w2', ring: 2 })
    expect(city.blocks[0]).toMatchObject({ openTickets: 1, owed: 4000, coins: 2 })
    const withInactive = buildCity(data({ tickets: [t({ contractorUuid: 'z' })] }), '2026-10', '2026-10-31')
    expect(withInactive.blocks.map((b) => b.name)).toContain('Zeta')
  })

  it('positions do not move between months; the tide is scaled across the timeline', () => {
    const tickets = [t({ openedAt: '2026-08-01', status: 'Closed', closedAt: '2026-09-15', amountOwed: 500 }), t({ openedAt: '2026-10-02' })]
    const [sep, oct] = buildTimeline(data({ tickets }), ['2026-09', '2026-10'], '2026-10-31')
    expect(sep.towers.map((x) => [x.x, x.z])).toEqual(oct.towers.map((x) => [x.x, x.z]))
    expect([sep.tide.open, oct.tide.open, sep.tide.max]).toEqual([0, 1, 1])
    expect(oct.tide.level).toBe(1)
    expect(sep.recovered).toBe(500)
  })

  it('camp countdown at the month end', () => {
    const camps = [{ uuid: 'k', name: 'Camp A', active: true, cycleDays: 90, contractorUuid: '', workOrderUuid: '', location: '' } as unknown as Camp]
    const inspections = [{ templateId: 'accommodation', info: { reviewDate: '2026-10-01', facilityLocation: 'Camp A', contractorNames: '' }, responses: {}, campUuid: 'k' }] as never
    const sep = buildCity(data({ camps, inspections }), '2026-09', '2026-10-31')
    const oct = buildCity(data({ camps, inspections }), '2026-10', '2026-10-31')
    expect(sep.camps[0]).toMatchObject({ status: 'never', fraction: 0 })
    expect(oct.camps[0]).toMatchObject({ inspectedThisMonth: true, daysLeft: 60 })
    expect(oct.camps[0].fraction).toBeCloseTo(60 / 90)
  })

  it('timeline months end with the current month', () => {
    expect(timelineMonths(3, '2026-02-10')).toEqual(['2025-12', '2026-01', '2026-02'])
  })
})
