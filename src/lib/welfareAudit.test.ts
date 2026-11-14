import { describe, expect, it } from 'vitest'
import { auditKpiPlan, presetAnswers, scoresOnly, withAudit } from './welfareAudit'
import { isChecked, scoreInspection } from './score'
import { getTemplate } from '../templates'
import { emptyKpi } from './subjects'
import type { AllData } from './kpiData'
import type { ComplianceAssessment, Contractor, Inspection, KpiMonth, WorkOrder } from '../types'

const c1 = { uuid: 'c1', name: 'RPCO', active: true, aliases: [] } as unknown as Contractor
const wo = (uuid: string, number: string) => ({ uuid, contractorUuid: 'c1', number, label: '', active: true }) as WorkOrder
const data = (kpis: KpiMonth[] = []): AllData => {
  const workOrders = [wo('w1', '882'), wo('w2', '1134')]
  return {
    loaded: true, contractors: [c1], byUuid: new Map([[c1.uuid, c1]]), workOrders, woByUuid: new Map(workOrders.map((w) => [w.uuid, w])),
    camps: [], tickets: [], cases: [], kpis, manpower: [], weekly: [], inspections: [], audits: [],
  }
}
const r = (assessment: ComplianceAssessment) => ({ yesNo: '' as const, assessment, observation: '', actionPlan: '' })
const audit = (p: Partial<Inspection> = {}): Inspection => ({
  uuid: 'aud-1', templateId: 'welfare_audit', status: 'completed', createdAt: '', updatedAt: '',
  info: { reviewDate: '2026-11-12', workOrderUuid: 'w1', contractorUuid: 'c1', contractorNames: 'RPCO' } as Inspection['info'],
  responses: { A1: r('Full compliance'), A2: r('No compliance'), A3: r('Partial compliance'), B1: r('No compliance'), B2: r('N/A') },
  notes: '', ...p,
})

describe('A completed Worker Welfare audit fills the quarterly audit KPI', () => {
  it('for its work order and the audit date’s month: score, date, findings (the Nos), due 30 days after', () => {
    const plan = auditKpiPlan(audit(), data())!
    // A: (1 + 0 + 0.5) / 3 = 50; B: 0 / 1 = 0 → 25
    expect(plan).toMatchObject({ month: '2026-11', workOrderUuid: 'w1', contractorUuid: 'c1', pct: 25, findings: 2, date: '2026-11-12', dueDate: '2026-12-12', replaces: null })
    const k = withAudit(emptyKpi('c1', 'w1', '2026-11'), plan, 'aud-1')
    expect(k).toMatchObject({ quarterlyAuditPct: 25, auditDate: '2026-11-12', auditFindings: 2, auditClosed: 0, auditDueDate: '2026-12-12', auditInspectionUuid: 'aud-1' })
  })

  it('says which typed score it replaces: this month’s or another month of the quarter', () => {
    const typed = { ...emptyKpi('c1', 'w1', '2026-10'), quarterlyAuditPct: 82 }
    expect(auditKpiPlan(audit(), data([typed]))!.replaces).toEqual({ month: '2026-10', pct: 82 })
    const same = { ...emptyKpi('c1', 'w1', '2026-11'), quarterlyAuditPct: 77 }
    expect(auditKpiPlan(audit(), data([same]))!.replaces).toEqual({ month: '2026-11', pct: 77 })
    // its own earlier save is not "another" score
    const mine = { ...same, auditInspectionUuid: 'aud-1' }
    expect(auditKpiPlan(audit(), data([mine]))!.replaces).toBeNull()
  })

  it('completing it again keeps how many findings were closed', () => {
    const plan = auditKpiPlan(audit(), data())!
    const before = { ...emptyKpi('c1', 'w1', '2026-11'), quarterlyAuditPct: 30, auditFindings: 3, auditClosed: 1, auditInspectionUuid: 'aud-1' }
    expect(withAudit(before, plan, 'aud-1').auditClosed).toBe(1)
    expect(withAudit({ ...before, auditInspectionUuid: 'other' }, plan, 'aud-1').auditClosed).toBe(0)
  })

  it('nothing to save without a work order, a date or a score', () => {
    expect(auditKpiPlan(audit({ info: { reviewDate: '2026-11-12' } as Inspection['info'] }), data())).toBeNull()
    expect(auditKpiPlan(audit({ responses: {} }), data())).toBeNull()
    expect(auditKpiPlan(audit({ info: { workOrderUuid: 'w1', contractorUuid: 'c1' } as Inspection['info'] }), data())).toBeNull()
  })
})

describe('Finishing an audit keeps the scores only', () => {
  const template = getTemplate('welfare_audit')!
  const full = audit({
    id: 4,
    status: 'draft',
    notes: 'met the camp boss',
    info: { ...audit().info, workOrder: '882', project: 'Package 1', auditor: 'Sam', contactNo: '0500000000', clientRep: 'A', contractorRep: 'B', approvedBy: 'C', inspectionNo: 'WWA-2026-Q4-882' } as Inspection['info'],
  })

  it('the final score, grade, every section’s score and the findings', () => {
    const kept = scoresOnly(full, template, '2026-11-14T09:00:00.000Z')!
    const s = scoreInspection(template, full)
    expect(kept.logged).toEqual({
      pct: s.pct,
      rating: 'Non-compliant',
      sections: s.sections!.map((x) => ({ letter: x.letter, title: x.title, pct: x.pct })),
      findings: 2,
    })
    expect(kept.logged!.sections!.slice(0, 2)).toEqual([
      { letter: 'A', title: template.sections[0].title, pct: 50 },
      { letter: 'B', title: template.sections[1].title, pct: 0 },
    ])
    expect(kept.logged!.sections).toHaveLength(14)
  })

  it('no answers, notes, names or phone number; still says which audit it was', () => {
    const kept = scoresOnly(full, template, '2026-11-14T09:00:00.000Z')!
    expect(kept).toMatchObject({ id: 4, uuid: 'aud-1', status: 'completed', responses: {}, notes: '', updatedAt: '2026-11-14T09:00:00.000Z' })
    expect(kept.info).toMatchObject({ reviewDate: '2026-11-12', workOrderUuid: 'w1', contractorUuid: 'c1', contractorNames: 'RPCO', workOrder: '882', project: 'Package 1', inspectionNo: 'WWA-2026-Q4-882' })
    for (const k of ['auditor', 'contactNo', 'clientRep', 'contractorRep', 'approvedBy']) expect(kept.info).not.toHaveProperty(k)
  })

  it('nothing to keep before anything is scored', () => {
    expect(scoresOnly(audit({ responses: {} }), template, 'now')).toBeNull()
  })
})

describe('A new audit starts with every answer Full, like the Excel', () => {
  const template = getTemplate('welfare_audit')!
  const at = '2026-11-14T08:00:00.000Z'
  it('118 answers, all Full and preset, scoring 100% with nothing checked yet', () => {
    const responses = presetAnswers(template, at)
    expect(Object.keys(responses)).toHaveLength(118)
    expect(Object.values(responses).every((r) => r.assessment === 'Full compliance' && r.preset && r.at === at)).toBe(true)
    const ins = audit({ responses, status: 'draft' })
    expect(scoreInspection(template, ins).pct).toBe(100)
    expect(Object.values(responses).filter(isChecked)).toHaveLength(0)
  })
  it('confirming or changing one makes it checked; the score follows the answers', () => {
    const responses = presetAnswers(template, at)
    responses.A1 = { ...responses.A1, preset: false }
    responses.A2 = { ...responses.A2, assessment: 'No compliance', preset: false }
    const ins = audit({ responses, status: 'draft' })
    expect(Object.values(responses).filter(isChecked)).toHaveLength(2)
    expect(scoreInspection(template, ins).sections!.find((x) => x.letter === 'A')!.pct).toBeCloseTo((13 / 14) * 100, 5)
  })
})
