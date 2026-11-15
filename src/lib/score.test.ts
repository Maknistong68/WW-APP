import { describe, expect, it } from 'vitest'
import { gradeOf, projectedScore, scoreInspection } from './score'
import { welfareAudit } from '../templates/welfareAudit'
import { WELFARE_COMMENTS } from '../templates/welfareComments'
import { accommodation } from '../templates/accommodation'
import type { ComplianceAssessment, Inspection, InspectionTemplate } from '../types'

const answer = (assessment: ComplianceAssessment) => ({ yesNo: '' as const, assessment, observation: '', actionPlan: '' })
const audit = (pick: (code: string) => ComplianceAssessment | undefined, t: InspectionTemplate = welfareAudit): Inspection => {
  const responses: Inspection['responses'] = {}
  for (const s of t.sections) for (const q of s.questions) {
    const a = pick(q.code)
    if (a) responses[q.code] = answer(a)
  }
  return { templateId: t.id, status: 'draft', createdAt: '', updatedAt: '', info: {} as Inspection['info'], responses, notes: '' }
}

describe('Worker Welfare checklist', () => {
  it('has the 14 sections and 118 questions of the workbook, each with three ready comments', () => {
    expect(welfareAudit.sections.map((s) => [s.letter, s.questions.length])).toEqual([
      ['A', 14], ['B', 13], ['C', 7], ['D', 6], ['E', 17], ['F', 11], ['G', 14],
      ['H', 7], ['I', 6], ['J', 7], ['K', 5], ['L', 4], ['M', 2], ['N', 5],
    ])
    const codes = welfareAudit.sections.flatMap((s) => s.questions.map((q) => q.code))
    expect(new Set(codes).size).toBe(118)
    for (const c of codes) expect(WELFARE_COMMENTS[c]).toHaveLength(3)
    expect(welfareAudit).toMatchObject({ answers: 'compliance', scoring: 'sections', startFrom: 'workOrder' })
  })
})

describe('Scoring by sections (Worker Welfare)', () => {
  it('matches the workbook: an N/A is left out, a section is points ÷ points possible, the audit averages its sections', () => {
    // the workbook's sample: everything Full, B7 N/A, five Nos in F (6 of 11)
    const nos = new Set(['F4', 'F5', 'F6', 'F7', 'F8'])
    const s = scoreInspection(welfareAudit, audit((c) => (c === 'B7' ? 'N/A' : nos.has(c) ? 'No compliance' : 'Full compliance')))
    const by = Object.fromEntries(s.sections!.map((x) => [x.letter, x]))
    expect(by.B).toMatchObject({ points: 12, possible: 12, pct: 100 })
    expect(by.F).toMatchObject({ points: 6, possible: 11 })
    expect(by.F.pct).toBeCloseTo(54.5, 1)
    // (13 × 100 + 54.5) ÷ 14 = 96.75 → 96.8
    expect(s.pct).toBe(96.8)
    expect(s.flagged).toBe(5)
    expect(s.answered).toBe(118)
  })

  it('Partial earns half the points; sections not answered yet are left out of the average', () => {
    const s = scoreInspection(welfareAudit, audit((c) => (c === 'A1' ? 'Partial compliance' : c.startsWith('A') ? 'Full compliance' : undefined)))
    // A: 13.5 of 14 = 96.4; only A is answered
    expect(s.sections!.find((x) => x.letter === 'A')!.pct).toBeCloseTo(96.43, 1)
    expect(s.sections!.find((x) => x.letter === 'B')!.pct).toBeNull()
    expect(s.pct).toBe(96.4)
  })

  it('nothing answered: no score', () => {
    expect(scoreInspection(welfareAudit, audit(() => undefined)).pct).toBeNull()
  })

  it('the camp checklist keeps its plain average', () => {
    const s = scoreInspection(accommodation, audit((c) => (c === 'A1' ? 'No compliance' : c === 'A2' ? 'Full compliance' : undefined), accommodation))
    expect(s.pct).toBe(50)
    expect(s.sections).toBeUndefined()
  })

  it('grades: Excellent 90+, Good 80+, Partially compliant 70+, Minimally compliant 60+, else Non-compliant', () => {
    expect([100, 90, 89.9, 80, 70, 69.9, 60, 59.9, 0].map(gradeOf)).toEqual([
      'Excellent', 'Excellent', 'Good', 'Good', 'Partially compliant', 'Minimally compliant', 'Minimally compliant', 'Non-compliant', 'Non-compliant',
    ])
    expect(gradeOf(null)).toBe('')
  })
})

describe('The score at the top while a checklist is done: unanswered counts as Full', () => {
  const blank = (templateId: string) => ({ templateId, status: 'draft', createdAt: '', updatedAt: '', notes: '', info: {} as Inspection['info'], responses: {} }) as Inspection
  const r = (assessment: ComplianceAssessment) => ({ yesNo: '' as const, assessment, observation: '', actionPlan: '' })
  it('a new audit and a new camp inspection read 100%', () => {
    expect(projectedScore(welfareAudit, blank('welfare_audit'))).toBe(100)
    expect(projectedScore(accommodation, blank('accommodation'))).toBe(100)
  })
  it('one No brings its section down, and the total with it', () => {
    const ins = { ...blank('welfare_audit'), responses: { F4: r('No compliance') } }
    // F: 10 of 11 → 90.9…; the 14 sections average: (13 × 100 + 90.9…) / 14 = 99.35…, shown to one decimal
    expect(projectedScore(welfareAudit, ins)).toBe(99.4)
    expect(scoreInspection(welfareAudit, ins).pct).toBe(0)
  })
  it('answered questions count as they are', () => {
    const responses = Object.fromEntries(welfareAudit.sections.flatMap((s) => s.questions.map((q) => [q.code, r('Partial compliance')])))
    expect(projectedScore(welfareAudit, { ...blank('welfare_audit'), responses })).toBe(50)
  })
})
