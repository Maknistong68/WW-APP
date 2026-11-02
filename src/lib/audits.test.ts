import { describe, expect, it } from 'vitest'
import { campScoreSeries, contractorAudits, quarterOf, quarterlyAudits } from './audits'
import { inspectionScore } from './inspectionScore'
import type { AllData } from './kpiData'
import { kpiSubjects } from './subjects'
import type { Camp, Contractor, Inspection, KpiMonth, WorkOrder } from '../types'

const a = { uuid: 'a', name: 'RPCO', active: true, aliases: ['RP Co'] } as unknown as Contractor
const b = { uuid: 'b', name: 'SIBS', active: true, aliases: [] } as unknown as Contractor
const workOrders = [
  { uuid: 'w1', contractorUuid: 'a', number: '882', label: '', active: true },
  { uuid: 'w2', contractorUuid: 'a', number: '1134', label: '', active: true },
] as WorkOrder[]
const camp = { uuid: 'p1', name: 'Camp 3', contractorUuid: 'a', active: true, cycleDays: 90, location: '' } as Camp
const resp = (assessment: string) => ({ yesNo: '', assessment, observation: '', actionPlan: '' })
const ins = (id: number, p: Partial<Inspection>): Inspection =>
  ({
    id,
    uuid: `i${id}`,
    templateId: 'welfare_audit',
    status: 'completed',
    createdAt: '',
    updatedAt: '',
    notes: '',
    info: { reviewDate: '2026-10-12', facilityLocation: 'Camp 3', contractorNames: '' },
    responses: { A1: resp('Full compliance'), A2: resp('Partial compliance') },
    ...p,
  }) as unknown as Inspection
const inspections = [
  ins(7, { campUuid: 'p1' }), // RPCO's camp: 75%, 1 finding
  ins(8, { info: { reviewDate: '2026-09-03', facilityLocation: 'Site office', contractorNames: 'RP Co and SIBS' } as Inspection['info'] }),
  ins(9, { status: 'draft', campUuid: 'p1' }), // drafts never count
]
const d: AllData = {
  loaded: true,
  contractors: [a, b],
  byUuid: new Map([
    [a.uuid, a],
    [b.uuid, b],
  ]),
  workOrders,
  woByUuid: new Map(workOrders.map((w) => [w.uuid, w])),
  camps: [camp],
  tickets: [],
  kpis: [
    { contractorUuid: 'a', workOrderUuid: 'w1', month: '2026-05', quarterlyAuditPct: 80 },
    { contractorUuid: 'a', workOrderUuid: 'w2', month: '2026-05', quarterlyAuditPct: 70, auditFindings: 5, auditClosed: 2 },
    { contractorUuid: 'a', workOrderUuid: 'w1', month: '2026-06', quarterlyAuditPct: 90 },
    { contractorUuid: 'b', workOrderUuid: '', month: '2026-10', quarterlyAuditPct: 60 },
  ] as KpiMonth[],
  manpower: [],
  weekly: [],
  inspections,
}

describe('Audit history', () => {
  it('names quarters', () => {
    expect(quarterOf('2026-05')).toEqual({ key: '2026-Q2', label: 'Q2 2026', months: ['2026-04', '2026-05', '2026-06'] })
  })
  it('quarterly audits: newest quarter first, each work order’s latest score in the quarter', () => {
    const q = quarterlyAudits(d, kpiSubjects(d.contractors, d.workOrders))
    expect(q.map((x) => [x.label, x.avg, x.audited, x.total, x.lastMonth])).toEqual([
      ['Q4 2026', 60, 1, 3, '2026-10'],
      ['Q2 2026', 80, 2, 3, '2026-06'],
    ])
    expect(q[1].rows.find((r) => r.subject.workOrder?.uuid === 'w2')).toMatchObject({ pct: 70, findings: 5, closed: 2 })
  })
  it('scores an inspection once (memoised) and leaves drafts out', () => {
    expect(inspectionScore(inspections[0])).toMatchObject({ pct: 75, flagged: 1 })
    expect(inspectionScore(inspections[0])).toBe(inspectionScore(inspections[0]))
  })
  it('a contractor’s audits: quarterly scores and its camp inspections, newest first, with a monthly series', () => {
    const { series, list } = contractorAudits(d, a, ['2026-05', '2026-06', '2026-09', '2026-10'])
    expect(series).toEqual([75, 90, 75, 75])
    expect(list.map((x) => [x.kind, x.title, x.pct, x.to])).toEqual([
      ['inspection', 'Camp 3 · 12 Oct', 75, '/inspection/7'],
      ['inspection', 'Site office · 3 Sep', 75, '/inspection/8'],
      ['quarterly', 'Q2 2026 · WO 882', 90, '/contractors/a?m=2026-06'],
      ['quarterly', 'Q2 2026 · WO 882', 80, '/contractors/a?m=2026-05'],
      ['quarterly', 'Q2 2026 · WO 1134', 70, '/contractors/a?m=2026-05'],
    ])
    expect(list.find((x) => x.title === 'Q2 2026 · WO 1134')!.detail).toBe('2 of 5 findings closed')
    expect(list[0].detail).toBe('1 finding')
  })
  it('a camp’s score over time: completed inspections only, oldest first', () => {
    expect(campScoreSeries(camp, inspections)).toEqual([{ id: 7, date: '2026-10-12', value: 75 }])
  })
})
