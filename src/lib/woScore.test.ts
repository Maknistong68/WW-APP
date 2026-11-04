import { afterEach, describe, expect, it } from 'vitest'
import { kpiForSubject, type AllData } from './kpiData'
import { emptyKpi, emptyManpower, kpiSubjects } from './subjects'
import { itemHistory, woHistory, woScore } from './woScore'
import { ENTRY_ITEMS } from './entryItems'
import { setDoc } from './submissions'
import { setDocRules } from './docRules'
import type { Contractor, KpiMonth, WorkOrder } from '../types'

const c1 = { uuid: 'c1', name: 'RPCO', active: true, aliases: [] } as unknown as Contractor
const w1 = { uuid: 'w1', contractorUuid: 'c1', number: '882', label: '', active: true } as WorkOrder
const data = (kpis: KpiMonth[]): AllData => ({
  loaded: true,
  contractors: [c1],
  byUuid: new Map([[c1.uuid, c1]]),
  workOrders: [w1],
  woByUuid: new Map([[w1.uuid, w1]]),
  camps: [],
  tickets: [],
  cases: [],
  kpis,
  manpower: [],
  weekly: [],
  inspections: [],
})
const month = (m: string, p: Partial<KpiMonth>): KpiMonth => ({
  ...emptyKpi('c1', 'w1', m),
  uuid: `k-${m}`,
  wps: true,
  manpowerDecl: true,
  salaryDecl: true,
  meetingPct: 100,
  ...p,
})
const score = (d: AllData, m: string) => Math.round(kpiForSubject(d, kpiSubjects(d.contractors, d.workOrders)[0], m).overall!)

describe('A work order’s score in Monthly entry', () => {
  const d = data([month('2026-08', { accommodationPct: 80 }), month('2026-09', { accommodationPct: 40 }), month('2026-10', { accommodationPct: 100 })])
  const s = kpiSubjects(d.contractors, d.workOrders)[0]
  it('the month’s KPI score and its change against last month', () => {
    const oct = woScore(d, s, '2026-10')
    expect(oct.pct).toBe(score(d, '2026-10'))
    expect(oct.change).toBe(score(d, '2026-10') - score(d, '2026-09'))
    expect(oct.change! > 0).toBe(true)
    expect(woScore(d, s, '2026-09').change! < 0).toBe(true)
    expect(oct.status).toBe(oct.pct! >= 90 ? 'good' : oct.pct! >= 70 ? 'warn' : 'bad')
  })
  it('no change shown when last month has no score; no score at all is null', () => {
    expect(woScore(d, s, '2026-08').change).toBeNull()
    expect(woScore(d, s, '2026-12')).toEqual({ pct: null, status: 'none', change: null })
  })
  it('the last 12 months for the chart, oldest first, with gaps where there is no score', () => {
    const h = woHistory(d, s, '2026-10')
    expect(h.months).toHaveLength(12)
    expect([h.months[0], h.months[11]]).toEqual(['2025-11', '2026-10'])
    expect(h.values.slice(0, 9).every((v) => v === null)).toBe(true)
    expect(h.values.slice(9)).toEqual([score(d, '2026-08'), score(d, '2026-09'), score(d, '2026-10')])
    expect(h.avg).toBe(Math.round((score(d, '2026-08') + score(d, '2026-09') + score(d, '2026-10')) / 3))
    expect(woHistory(data([]), s, '2026-10').avg).toBeNull()
  })
})

describe('One item’s history for a work order (By item, held)', () => {
  const item = (key: string) => ENTRY_ITEMS.find((i) => i.key === key)!
  afterEach(() => setDocRules([]))
  it('a KPI item: its score each month, gaps where nothing was entered, and the average', () => {
    const d = data([month('2026-08', { accommodationPct: 80 }), month('2026-10', { accommodationPct: 100 })])
    const s = kpiSubjects(d.contractors, d.workOrders)[0]
    const h = itemHistory(d, s, '2026-10', item('accommodation'))
    expect(h.kind).toBe('pct')
    expect(h.months.slice(-3)).toEqual(['2026-08', '2026-09', '2026-10'])
    expect(h.values.slice(-3)).toEqual([80, null, 100])
    expect(h.avg).toBe(90)
  })
  it('workers: the total each month, a count', () => {
    const mp = (m: string, total: number) => ({ ...emptyManpower('c1', 'w1', m), uuid: `m-${m}`, totalWorkers: total })
    const d = { ...data([]), manpower: [mp('2026-09', 120), mp('2026-10', 130)] }
    const s = kpiSubjects(d.contractors, d.workOrders)[0]
    const h = itemHistory(d, s, '2026-10', item('workers'))
    expect(h.kind).toBe('count')
    expect(h.values.slice(-3)).toEqual([null, 120, 130])
    expect(h.avg).toBe(125)
  })
  it('a document: where it stood each month, N/A carried on, and switched-off months', () => {
    const d = data([
      setDoc(month('2026-07', {}), 'waterTest', { state: 'in', on: '2026-08-05' }),
      setDoc(month('2026-08', {}), 'waterTest', { state: 'na' }),
      month('2026-09', {}),
    ])
    const s = kpiSubjects(d.contractors, d.workOrders)[0]
    setDocRules([{ key: 'waterTest', off: true, from: '2026-10' }])
    const h = itemHistory(d, s, '2026-10', item('waterTest'))
    expect(h.kind).toBe('doc')
    // months before it was first answered were not tracked yet: not shown as missing
    expect(h.states?.slice(-5)).toEqual(['none', 'in', 'na', 'na', 'off'])
    expect(h.counts).toEqual({ in: 1, notProvided: 0, awaited: 0 })
  })
  it('a document still waiting after it was first answered counts as missing', () => {
    const d = data([setDoc(month('2026-08', {}), 'waterTest', { state: 'in', on: '2026-09-02' }), month('2026-09', {})])
    const s = kpiSubjects(d.contractors, d.workOrders)[0]
    const h = itemHistory(d, s, '2026-10', item('waterTest'))
    expect(h.states?.slice(-3)).toEqual(['in', 'awaited', 'awaited'])
    expect(h.counts).toEqual({ in: 1, notProvided: 0, awaited: 2 })
  })
})
