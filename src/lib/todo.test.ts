import { describe, expect, it } from 'vitest'
import { SUBJECT_ITEMS } from './todo'
import { markAllIn, setDoc } from './submissions'
import { emptyKpi, kpiSubjects } from './subjects'
import type { AllData } from './kpiData'
import type { Contractor, KpiMonth, WorkOrder } from '../types'

const c1 = { uuid: 'c1', name: 'RPCO', active: true, aliases: [] } as unknown as Contractor
const wo = (uuid: string, number: string) => ({ uuid, contractorUuid: 'c1', number, label: '', active: true }) as WorkOrder
const data = (kpis: KpiMonth[]): AllData => {
  const workOrders = [wo('w1', '882'), wo('w2', '1134')]
  return {
    loaded: true,
    contractors: [c1],
    byUuid: new Map([[c1.uuid, c1]]),
    workOrders,
    woByUuid: new Map(workOrders.map((w) => [w.uuid, w])),
    camps: [],
    tickets: [],
    cases: [],
    kpis,
    manpower: [],
    weekly: [],
    inspections: [],
  }
}
const oct = (w: string) => emptyKpi('c1', w, '2026-10')

describe('Monthly documents: one work order', () => {
  it('done when every document is in, not provided or N/A; what is entered in a line', () => {
    const d = data([markAllIn(oct('w1'), '2026-11-02'), setDoc(oct('w2'), 'wps', { state: 'in', on: '2026-11-02' })])
    const [w1134, w882] = kpiSubjects(d.contractors, d.workOrders).sort((a, b) => a.label.localeCompare(b.label))
    expect(SUBJECT_ITEMS.submission.done(d, w882, '2026-10')).toBe(true)
    expect(SUBJECT_ITEMS.submission.done(d, w1134, '2026-10')).toBe(false)
    expect(SUBJECT_ITEMS.submission.value(d, w1134, '2026-10')).toBe('1 of 11 in · Missing Report, Issue log +8')
  })
  it('N/A last month is not chased this month', () => {
    const d = data([setDoc(emptyKpi('c1', 'w1', '2026-09'), 'waterTest', { state: 'na' })])
    const w882 = kpiSubjects(d.contractors, d.workOrders).find((s) => s.workOrder?.uuid === 'w1')!
    expect(SUBJECT_ITEMS.submission.value(d, w882, '2026-10')).toBe('')
    expect(SUBJECT_ITEMS.submission.done(d, w882, '2026-10')).toBe(false)
  })
})
