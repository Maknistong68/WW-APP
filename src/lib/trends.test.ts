import { describe, expect, it } from 'vitest'
import { contractorOverall } from './trends'
import type { AllData } from './kpiData'
import type { Contractor, KpiMonth } from '../types'

const c = { uuid: 'c', name: 'RPCO', active: true, aliases: [] } as unknown as Contractor
const data = (kpis: Partial<KpiMonth>[]): AllData => ({
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
