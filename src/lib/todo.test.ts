import { describe, expect, it } from 'vitest'
import { SUBJECT_ITEMS, docMissing, docRows } from './todo'
import { markAllIn, setDoc } from './submissions'
import { emptyKpi } from './subjects'
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

describe('Missing documents list', () => {
  it('a work order is done when every document is in, not provided or N/A', () => {
    const d = data([markAllIn(oct('w1'), '2026-11-02'), setDoc(oct('w2'), 'wps', { state: 'in', on: '2026-11-02' })])
    expect(SUBJECT_ITEMS.submission.done(d, docRows(d, '2026-10')[1].s, '2026-10')).toBe(true)
    const rows = docRows(d, '2026-10')
    expect(rows.map((r) => [r.s.label, r.done])).toEqual([
      ['RPCO · WO 1134', false],
      ['RPCO · WO 882', true],
    ])
    expect(rows[0].value).toBe('1 of 11 in · Missing Report, Issue log +8')
    expect(rows[0].waiting.length).toBe(10)
  })
  it('one document: who hasn’t sent it, and how many per document', () => {
    const d = data([setDoc(oct('w1'), 'waterTest', { state: 'in', on: '2026-11-02' }), setDoc(oct('w2'), 'pestControl', { state: 'na' })])
    const water = docRows(d, '2026-10', 'waterTest')
    expect(water.map((r) => [r.s.label, r.done, r.value])).toEqual([
      ['RPCO · WO 1134', false, 'Waiting'],
      ['RPCO · WO 882', true, 'In 2 Nov'],
    ])
    const counts = docMissing(d, '2026-10')
    expect([counts.waterTest, counts.pestControl, counts.wps]).toEqual([1, 1, 2])
  })
  it('N/A last month is not chased this month', () => {
    const d = data([setDoc(emptyKpi('c1', 'w1', '2026-09'), 'waterTest', { state: 'na' })])
    expect(docRows(d, '2026-10', 'waterTest').find((r) => r.s.label === 'RPCO · WO 882')?.value).toBe('N/A')
  })
})
