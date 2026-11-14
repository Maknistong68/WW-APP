import { describe, expect, it } from 'vitest'
import { shapeAllData } from './kpiData'
import { auditPctFor } from './kpiData'
import type { Contractor, Inspection } from '../types'

const c1 = { uuid: 'c1', name: 'RPCO', active: true, aliases: [] } as unknown as Contractor
const done = (templateId: string, id: number): Inspection =>
  ({
    id, uuid: `i${id}`, templateId, status: 'completed', createdAt: '', updatedAt: '', notes: '', campUuid: 'k1',
    info: { reviewDate: '2026-10-20', contractorNames: 'RPCO', contractorUuid: 'c1' },
    responses: { A1: { yesNo: '', assessment: 'No compliance', observation: '', actionPlan: '' } },
  }) as unknown as Inspection

describe('Camp inspections and Worker Welfare audits, apart', () => {
  const raw = { contractors: [c1], workOrders: [], camps: [], tickets: [], kpis: [], manpower: [], weekly: [], inspections: [done('accommodation', 1), done('welfare_audit', 2)] }
  const d = shapeAllData(raw, true)

  it('the app’s data gives camp inspections and audits separately', () => {
    expect(d.inspections.map((i) => i.id)).toEqual([1])
    expect(d.audits?.map((i) => i.id)).toEqual([2])
  })

  it('an audit never fills the accommodation KPI', () => {
    expect(auditPctFor(c1, d.audits!, '2026-10')).not.toBeNull() // it would, if it were let in
    expect(auditPctFor(c1, d.inspections, '2026-10')).toBe(0) // the camp inspection's own score
  })
})
