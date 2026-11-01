import { describe, expect, it } from 'vitest'
import {
  contractorKpiSeries,
  contractorMoneySeries,
  contractorOverall,
  contractorTicketSeries,
  contractorWorkforceSeries,
  itemInputs,
  trendMonths,
  trendSummary,
} from './trends'
import type { AllData } from './kpiData'
import type { Contractor, KpiMonth, Manpower, Ticket, WorkOrder } from '../types'

const c = { uuid: 'c', name: 'RPCO', active: true, aliases: [] } as unknown as Contractor
const data = (kpis: Partial<KpiMonth>[], p: Partial<AllData> = {}): AllData => ({
  loaded: true,
  contractors: [c],
  byUuid: new Map([[c.uuid, c]]),
  workOrders: [],
  woByUuid: new Map(),
  camps: [],
  tickets: [],
  kpis: kpis as KpiMonth[],
  manpower: [],
  weekly: [],
  inspections: [],
  ...p,
})

describe('One contractor over the months', () => {
  it('gives the overall KPI per month, null where there is no data (never 0)', () => {
    const d = data([
      { contractorUuid: 'c', workOrderUuid: '', month: '2026-09', wps: true, manpowerDecl: true, salaryDecl: true },
      { contractorUuid: 'c', workOrderUuid: '', month: '2026-10', wps: true, manpowerDecl: false, salaryDecl: true, onboardingPct: 70 },
    ])
    expect(contractorOverall(d, c, ['2026-08', '2026-09', '2026-10'])).toEqual([null, 100, 60])
  })
})

// Two work orders; WO 1134 has since been switched off but has a September record.
const wos = [
  { uuid: 'w1', contractorUuid: 'c', number: '882', label: '', active: true },
  { uuid: 'w2', contractorUuid: 'c', number: '1134', label: '', active: false },
] as WorkOrder[]
const T = (p: Partial<Ticket>): Ticket => ({ uuid: Math.random().toString(36), contractorUuid: 'c', workOrderUuid: 'w1', status: 'Open', closedAt: '', amountOwed: null, workers: 1, ...p }) as Ticket
const tickets = [
  T({ openedAt: '2026-10-01', status: 'Closed', closedAt: '2026-10-13' }),
  T({ openedAt: '2026-10-20', amountOwed: 1000 }),
  T({ openedAt: '2026-09-10', status: 'Closed', closedAt: '2026-10-05', amountOwed: 500 }),
]
const full = data(
  [
    { contractorUuid: 'c', workOrderUuid: 'w1', month: '2026-09', wps: true, manpowerDecl: true, salaryDecl: true },
    { contractorUuid: 'c', workOrderUuid: 'w2', month: '2026-09', wps: true, manpowerDecl: false, salaryDecl: true },
  ],
  {
    workOrders: wos,
    woByUuid: new Map(wos.map((w) => [w.uuid, w])),
    tickets,
    manpower: [{ contractorUuid: 'c', workOrderUuid: 'w1', month: '2026-10', totalWorkers: 100, illegalOrFreelance: 3, visaExpiring30d: 2, paidRecruitmentFees: 0 }] as Manpower[],
  },
)

describe('Contractor trends', () => {
  it('months: the last 6 or 12 ended, or all since its first record', () => {
    expect(trendMonths(full, c, '6m', '2026-11-05')).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'])
    expect(trendMonths(full, c, '1y', '2026-11-05')).toHaveLength(12)
    expect(trendMonths(full, c, 'all', '2026-11-05')).toEqual(['2026-09', '2026-10'])
  })
  it('a switched-off work order keeps its past months; one work order can be picked', () => {
    expect(contractorKpiSeries(full, c, ['2026-09']).submission).toEqual([75])
    expect(contractorKpiSeries(full, c, ['2026-09'], 'w1').submission).toEqual([100])
  })
  it('tickets per month: opened, closed, average days to close, open at month end', () => {
    const [sep, oct] = contractorTicketSeries(full, c, ['2026-09', '2026-10'], undefined, '2026-11-05')
    expect([sep.opened, sep.closed, sep.avgDaysToClose, sep.openAtEnd]).toEqual([1, 0, null, 1])
    expect([oct.opened, oct.closed, oct.avgDaysToClose, oct.openAtEnd]).toEqual([2, 2, 18.5, 1])
  })
  it('money: SAR owed at month end and recovered in the month', () => {
    expect(contractorMoneySeries(full, c, ['2026-09', '2026-10'], undefined, '2026-11-05')).toEqual([
      { owedAtEnd: 500, recovered: 0 },
      { owedAtEnd: 1000, recovered: 500 },
    ])
  })
  it('workers per month, null without a declaration', () => {
    expect(contractorWorkforceSeries(full, c, ['2026-09', '2026-10'])).toEqual([null, { total: 100, illegal: 3, visas: 2, paidFees: 0 }])
  })
  it('summary: now, change since the month before, months on track', () => {
    expect(trendSummary([60, null, 92, 95])).toEqual({ now: 95, prev: 92, change: 3, onTrack: 2, months: 3 })
    expect(trendSummary([null, null])).toEqual({ now: null, prev: null, change: null, onTrack: 0, months: 0 })
  })
  it('explains a score from what made it', () => {
    expect(itemInputs(full, c, 'grievance', '2026-10')).toBe('2 closed · avg 19 days')
    expect(itemInputs(full, c, 'closure', '2026-10')).toBe('2 of 3 closed')
    expect(itemInputs(full, c, 'formal', '2026-10')).toBe('100 workers · 3 illegal')
    expect(itemInputs(full, c, 'submission', '2026-09', 'w2')).toBe('Manpower missing')
  })
})
