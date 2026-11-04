import { describe, expect, it } from 'vitest'
import {
  ENTRY_ITEMS,
  MONTHLY_KPIS,
  entryDone,
  entryFromMissing,
  entryLink,
  entryProblem,
  entryValue,
  itemLeft,
  mergeRow,
  otherQuarterAudit,
  parseEntry,
  rowChanged,
  woProgress,
} from './entryItems'
import { setDoc } from './submissions'
import { emptyKpi, emptyManpower, kpiSubjects } from './subjects'
import type { AllData } from './kpiData'
import type { Contractor, KpiMonth, Manpower, WorkOrder } from '../types'

const c1 = { uuid: 'c1', name: 'RPCO', active: true, aliases: [] } as unknown as Contractor
const wo = (uuid: string, number: string) => ({ uuid, contractorUuid: 'c1', number, label: '', active: true }) as WorkOrder
const data = (kpis: KpiMonth[] = [], manpower: Manpower[] = []): AllData => {
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
    manpower,
    weekly: [],
    inspections: [],
  }
}
const oct = (w: string, p: Partial<KpiMonth> = {}): KpiMonth => ({ ...emptyKpi('c1', w, '2026-10'), uuid: `k-${w}`, ...p })
const subject = (d: AllData, w: string) => kpiSubjects(d.contractors, d.workOrders).find((s) => s.workOrder?.uuid === w)!
const item = (key: string) => ENTRY_ITEMS.find((i) => i.key === key)!

describe('The items you can enter for every work order', () => {
  it('the 10 documents, then the KPIs', () => {
    expect(ENTRY_ITEMS.filter((i) => i.group === 'Documents')).toHaveLength(10)
    expect(ENTRY_ITEMS.filter((i) => i.group === 'KPIs').map((i) => i.key)).toEqual(['accommodation', 'onboarding', 'offboarding', 'meeting', 'workers', 'quarterly'])
    expect(MONTHLY_KPIS.map((i) => i.key)).toEqual(['accommodation', 'onboarding', 'offboarding', 'workers', 'meeting'])
  })
  it('done and what is entered, per item', () => {
    const d = data([setDoc(oct('w1', { accommodationPct: 90, meetingPct: 0 }), 'waterTest', { state: 'in', on: '2026-11-02' })], [
      { ...emptyManpower('c1', 'w2', '2026-10'), totalWorkers: 120, illegalOrFreelance: 2 },
    ])
    const w1 = subject(d, 'w1')
    const w2 = subject(d, 'w2')
    expect([entryDone(d, w1, '2026-10', item('waterTest')), entryValue(d, w1, '2026-10', item('waterTest'))]).toEqual([true, 'In 2 Nov'])
    expect([entryDone(d, w2, '2026-10', item('waterTest')), entryValue(d, w2, '2026-10', item('waterTest'))]).toEqual([false, 'Waiting'])
    expect(entryValue(d, w1, '2026-10', item('accommodation'))).toBe('90%')
    expect(entryValue(d, w1, '2026-10', item('meeting'))).toBe('Not attended')
    expect([entryDone(d, w2, '2026-10', item('workers')), entryValue(d, w2, '2026-10', item('workers'))]).toEqual([true, '120 workers · 2 illegal'])
    expect(itemLeft(d, '2026-10', item('waterTest'))).toBe(1)
  })
  it('a work order at a glance', () => {
    const d = data([setDoc(oct('w1', { accommodationPct: 90, onboardingPct: 80 }), 'wps', { state: 'in', on: '2026-11-02' })])
    // how much is entered: (1 document + 2 KPIs) of (10 + 5)
    expect(woProgress(d, subject(d, 'w1'), '2026-10')).toEqual({ text: 'Docs 1/10 · KPIs 2/5', done: false, pct: 0.2 })
  })
})

describe('Saving one row writes only that item over a fresh copy', () => {
  it('a % item: a teammate’s other answers stay', () => {
    const opened = oct('w1')
    const fresh = oct('w1', { onboardingPct: 75 })
    const out = mergeRow(item('accommodation'), fresh, opened, { ...opened, accommodationPct: 92 }) as KpiMonth
    expect([out.accommodationPct, out.onboardingPct]).toEqual([92, 75])
  })
  it('a document: only that document', () => {
    const opened = oct('w1')
    const fresh = setDoc(oct('w1'), 'wps', { state: 'in', on: '2026-11-01' })
    const out = mergeRow(item('waterTest'), fresh, opened, setDoc(opened, 'waterTest', { state: 'na' })) as KpiMonth
    expect([out.docs?.waterTest?.state, out.wps]).toEqual(['na', true])
  })
  it('workers: the manpower counts', () => {
    const opened = { ...emptyManpower('c1', 'w1', '2026-10'), uuid: 'm1' }
    const fresh = { ...opened, visaExpiring30d: 4 }
    const out = mergeRow(item('workers'), fresh, opened, { ...opened, totalWorkers: 80 }) as Manpower
    expect([out.totalWorkers, out.visaExpiring30d]).toEqual([80, 4])
  })
  it('a row typed back to what it was is not a change', () => {
    const opened = oct('w1', { accommodationPct: 80 })
    expect(rowChanged(item('accommodation'), opened, { ...opened, accommodationPct: 85 })).toBe(true)
    expect(rowChanged(item('accommodation'), opened, { ...opened, accommodationPct: 80 })).toBe(false)
    // another field moved (not this row's item): not this row's change
    expect(rowChanged(item('accommodation'), opened, { ...opened, onboardingPct: 10 })).toBe(false)
    expect(rowChanged(item('waterTest'), opened, setDoc(opened, 'waterTest', { state: 'na' }))).toBe(true)
  })
  it('problems are named before anything is saved', () => {
    expect(entryProblem(item('quarterly'), oct('w1', { auditFindings: 2, auditClosed: 3 }))).toBe('Closed out can’t be more than the findings')
    expect(entryProblem(item('workers'), { ...emptyManpower('c1', 'w1', '2026-10'), totalWorkers: 5, illegalOrFreelance: 6 })).toBe('Counts can’t be more than total workers')
    expect(entryProblem(item('accommodation'), oct('w1', { accommodationPct: 90 }))).toBeNull()
  })
})

describe('Quarterly audit: one per quarter', () => {
  it('entered in another month of the quarter: shown there, not asked again', () => {
    const d = data([oct('w1', { month: '2026-11', quarterlyAuditPct: 88 })])
    expect(otherQuarterAudit(d, subject(d, 'w1'), '2026-10')).toEqual({ month: '2026-11', pct: 88 })
    expect(otherQuarterAudit(d, subject(d, 'w1'), '2026-11')).toBeNull()
  })
})

describe('Links', () => {
  it('Monthly entry links and the old missing lists', () => {
    expect(entryLink({ m: '2026-10' })).toBe('/entry?m=2026-10')
    expect(entryLink({ by: 'item', item: 'waterTest', m: '2026-10' })).toBe('/entry?by=item&item=waterTest&m=2026-10')
    expect(entryFromMissing('submission', new URLSearchParams('m=2026-10'))).toBe('/entry?m=2026-10')
    expect(entryFromMissing('submission', new URLSearchParams('m=2026-10&doc=waterTest'))).toBe('/entry?by=item&item=waterTest&m=2026-10')
    expect(entryFromMissing('formal', new URLSearchParams('m=2026-09'))).toBe('/entry?by=item&item=workers&m=2026-09')
    expect(entryFromMissing('quarterly', new URLSearchParams(''))).toBe('/entry?by=item&item=quarterly')
    expect(entryFromMissing('nonsense', new URLSearchParams(''))).toBe('/entry')
  })
  it('reading the link back', () => {
    expect(parseEntry(new URLSearchParams('by=item&item=waterTest&m=2026-10'), '2026-11-03')).toEqual({ by: 'item', item: 'waterTest', month: '2026-10' })
    // defaults: by work order, the month that ended last, the first item
    expect(parseEntry(new URLSearchParams(''), '2026-11-03')).toEqual({ by: 'wo', item: 'welfareReport', month: '2026-10' })
    expect(parseEntry(new URLSearchParams('by=item&item=nope'), '2026-11-03').item).toBe('welfareReport')
  })
})
