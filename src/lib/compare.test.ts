import { describe, expect, it } from 'vitest'
import { columnAverages, compareRows, sortRows } from './compare'
import type { AllData } from './kpiData'
import type { Contractor, KpiMonth, WorkOrder } from '../types'

const C = (uuid: string, name: string, active = true) => ({ uuid, name, active, aliases: [] }) as unknown as Contractor
const contractors = [C('a', 'RPCO'), C('b', 'SIBS'), C('c', 'Old Co', false), C('d', 'Nofill')]
const workOrders = [{ uuid: 'w1', contractorUuid: 'a', number: '882', label: '', active: true }] as WorkOrder[]
const all3 = { wps: true, manpowerDecl: true, salaryDecl: true }
const d: AllData = {
  loaded: true,
  contractors,
  byUuid: new Map(contractors.map((c) => [c.uuid, c])),
  workOrders,
  woByUuid: new Map(workOrders.map((w) => [w.uuid, w])),
  camps: [],
  tickets: [],
  kpis: [
    { contractorUuid: 'a', workOrderUuid: 'w1', month: '2026-09', ...all3 },
    { contractorUuid: 'a', workOrderUuid: 'w1', month: '2026-10', wps: true, manpowerDecl: false, salaryDecl: true },
    { contractorUuid: 'b', workOrderUuid: '', month: '2026-09', wps: false, manpowerDecl: false, salaryDecl: false },
    { contractorUuid: 'c', workOrderUuid: '', month: '2026-09', ...all3 },
  ] as KpiMonth[],
  manpower: [],
  weekly: [],
  inspections: [],
}
const months = ['2026-09', '2026-10']

describe('Compare contractors', () => {
  it('one row per active contractor: its values, the latest and the change', () => {
    const rows = compareRows(d, months, 'submission')
    expect(rows.map((r) => r.label)).toEqual(['RPCO', 'SIBS', 'Nofill'])
    expect(rows[0]).toMatchObject({ contractorUuid: 'a', values: [100, 50], latest: 50, change: -50 })
    expect(rows[1]).toMatchObject({ values: [0, null], latest: 0, change: null })
    expect(rows[2]).toMatchObject({ values: [null, null], latest: null, change: null })
  })
  it('or one row per work order', () => {
    const rows = compareRows(d, months, 'submission', 'workOrder')
    expect(rows.map((r) => [r.label, r.workOrderUuid])).toEqual([
      ['RPCO · WO 882', 'w1'],
      ['SIBS', undefined],
      ['Nofill', undefined],
    ])
  })
  it('worst first by the latest month (no data last), or A–Z', () => {
    const rows = compareRows(d, months, 'submission')
    expect(sortRows(rows, 'worst').map((r) => r.label)).toEqual(['SIBS', 'RPCO', 'Nofill'])
    expect(sortRows(rows, 'name').map((r) => r.label)).toEqual(['Nofill', 'RPCO', 'SIBS'])
  })
  it('averages each month over the rows that have a value', () => {
    expect(columnAverages(compareRows(d, months, 'submission'), 2)).toEqual([50, 50])
    expect(columnAverages([], 2)).toEqual([null, null])
  })
})
