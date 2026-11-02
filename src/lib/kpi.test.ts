import { describe, expect, it } from 'vitest'
import { attendedPct, closurePct, computeKpi, declState, declWaiting, setDecl, formalPct, grievancePct, grievanceTier, kpiStatus, meetingAttended, offboardingScore, setOffboarding, submissionPct } from './kpi'
import type { KpiMonth, Ticket } from '../types'

const tk = (openedAt: string, closedAt = ''): Ticket => ({
  uuid: Math.random().toString(),
  updatedAt: '',
  source: 'Internal',
  ticketNo: '',
  channel: '',
  contractorUuid: 'c',
  workOrderUuid: '',
  subcontractor: '',
  category: '',
  issue: '',
  priority: 2,
  severity: '',
  workers: 1,
  violations: 1,
  amountOwed: null,
  parentUuid: '',
  assignedTo: '',
  status: closedAt ? 'Closed' : 'Open',
  openedAt,
  closedAt,
  contractorAction: '',
  wwAction: '',
  notes: '',
})

const kpi = (p: Partial<KpiMonth> = {}): KpiMonth => ({
  uuid: 'k',
  updatedAt: '',
  contractorUuid: 'c',
  workOrderUuid: '',
  month: '2026-10',
  wps: true,
  manpowerDecl: true,
  salaryDecl: true,
  accommodationPct: null,
  onboardingPct: null,
  offboarded: null,
  offboardTotal: null,
  meetingPct: null,
  quarterlyAuditPct: null,
  ...p,
})

describe('KPI rules', () => {
  it('submission: 3 yes = 100, 0 = 0, otherwise 50', () => {
    expect(submissionPct(kpi())).toBe(100)
    expect(submissionPct(kpi({ wps: false }))).toBe(50)
    expect(submissionPct(kpi({ wps: false, manpowerDecl: false, salaryDecl: false }))).toBe(0)
  })
  it('grievance tiers 10/15/20/30, beyond 30 = 0', () => {
    expect([10, 11, 15, 16, 20, 21, 30, 31, 100].map(grievanceTier)).toEqual([100, 90, 90, 80, 80, 70, 70, 0, 0])
  })
  it('grievance uses tickets closed in the month only', () => {
    const t = [tk('2026-09-20', '2026-10-02'), tk('2026-10-01', '2026-10-05'), tk('2026-08-01', '2026-09-01')]
    // (12 + 4) / 2 = 8 days → 100
    expect(grievancePct(t, '2026-10')).toBe(100)
    expect(grievancePct([tk('2026-10-01')], '2026-10')).toBeNull()
  })
  it('closure: closed in month ÷ open during month', () => {
    const t = [
      tk('2026-09-01'), // still open → counts in denominator
      tk('2026-10-03', '2026-10-10'), // closed in month
      tk('2026-08-01', '2026-09-15'), // closed before month → ignored
      tk('2026-11-02'), // opened after → ignored
    ]
    expect(closurePct(t, '2026-10')).toBe(50)
    expect(closurePct([], '2026-10')).toBeNull()
    // a running month with nothing closed yet is not scored (not 0%)
    expect(closurePct([tk('2026-10-01')], '2026-11', '2026-11-02')).toBeNull()
    // once the month is over, nothing closed is 0%
    expect(closurePct([tk('2026-10-01')], '2026-10', '2026-11-02')).toBe(0)
  })
  it('formal vs illegal from manpower counts', () => {
    expect(formalPct({ totalWorkers: 200, illegalOrFreelance: 10 })).toBe(95)
    expect(formalPct(undefined)).toBeNull()
  })
  it('overall averages the 8 non-blank KPIs, quarterly excluded; status thresholds', () => {
    const r = computeKpi({
      kpi: kpi({ accommodationPct: 80, meetingPct: 100, quarterlyAuditPct: 0 }),
      tickets: [],
      month: '2026-10',
    })
    // submission 100, accommodation 80, meeting 100 → 93.3
    expect(Math.round(r.overall!)).toBe(93)
    expect(r.status).toBe('good')
    expect([90, 89.9, 70, 69.9, null].map(kpiStatus)).toEqual(['good', 'warn', 'warn', 'bad', 'none'])
  })
  it('offboarding is the typed score; older months fall back to their counts or the Excel %', () => {
    expect(offboardingScore(kpi({ offboardingPct: 85 }))).toBe(85)
    expect(offboardingScore(kpi({ offboardingPct: 85, offboarded: 1, offboardTotal: 2 }))).toBe(85)
    expect(offboardingScore(kpi({ offboarded: 1, offboardTotal: 2 }))).toBe(50)
    expect(offboardingScore(kpi({ legacy: { offboardingPct: 70 } }))).toBe(70)
    expect(offboardingScore(kpi())).toBeNull()
    expect(offboardingScore(undefined)).toBeNull()
    expect(computeKpi({ kpi: kpi({ offboardingPct: 60 }), tickets: [], month: '2026-10' }).offboarding).toBe(60)
  })
  it('typing the offboarding score drops the older counts, so clearing it leaves it blank', () => {
    const old = kpi({ offboarded: 1, offboardTotal: 2, legacy: { offboardingPct: 70, formalPct: 90 } })
    const typed = setOffboarding(old, 95)
    expect(offboardingScore(typed)).toBe(95)
    expect(typed.legacy).toEqual({ offboardingPct: null, formalPct: 90 })
    expect(offboardingScore(setOffboarding(old, null))).toBeNull()
    // a month with no older data gains no extra fields
    expect(Object.keys(setOffboarding(kpi({ offboarded: undefined, offboardTotal: undefined }), 80))).not.toContain('legacy')
  })
  it('a declaration is in, not provided (the contractor can’t give it) or still awaited', () => {
    const k0 = kpi({ wps: false, manpowerDecl: false, salaryDecl: false })
    expect(declWaiting(k0).map((d) => d.key)).toEqual(['wps', 'manpowerDecl', 'salaryDecl'])
    const k1 = setDecl(setDecl(k0, 'salaryDecl', false), 'wps', true)
    expect([declState(k1, 'wps'), declState(k1, 'manpowerDecl'), declState(k1, 'salaryDecl')]).toEqual([true, null, false])
    expect(declWaiting(k1).map((d) => d.key)).toEqual(['manpowerDecl'])
    // not provided is left out of the score: WPS in, manpower awaited → 1 of 2 = 50; manpower not provided too → 100
    expect(submissionPct(k1)).toBe(50)
    expect(submissionPct(setDecl(k1, 'manpowerDecl', false))).toBe(100)
    expect(submissionPct(setDecl(k0, 'wps', false))).toBe(0)
    // nothing they can provide → blank, left out of the overall
    const none = setDecl(setDecl(setDecl(k0, 'wps', false), 'manpowerDecl', false), 'salaryDecl', false)
    expect(submissionPct(none)).toBeNull()
    expect(computeKpi({ kpi: none, tickets: [], month: '2026-10' }).submission).toBeNull()
    // changing the answer moves it out of the not-provided list; clearing leaves no empty list behind
    expect(setDecl(k1, 'salaryDecl', true).notProvided).toBeUndefined()
    expect(setDecl(k1, 'salaryDecl', null).notProvided).toBeUndefined()
    expect(setDecl(k1, 'wps', false)).toMatchObject({ wps: false, notProvided: ['wps', 'salaryDecl'] })
    expect(declWaiting(undefined)).toHaveLength(3)
  })
  it('meeting attendance is yes / no: stored as 100 / 0, blank until answered', () => {
    expect([true, false, null].map(attendedPct)).toEqual([100, 0, null])
    expect([100, 0, null, undefined].map(meetingAttended)).toEqual([true, false, null, null])
    expect(computeKpi({ kpi: kpi({ meetingPct: attendedPct(false) }), tickets: [], month: '2026-10' }).meeting).toBe(0)
  })
  it('accommodation falls back to the audit score', () => {
    expect(computeKpi({ kpi: kpi(), tickets: [], month: '2026-10', auditPct: 72 }).accommodation).toBe(72)
    expect(computeKpi({ kpi: kpi({ accommodationPct: 90 }), tickets: [], month: '2026-10', auditPct: 72 }).accommodation).toBe(90)
  })
})
