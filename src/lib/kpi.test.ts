import { describe, expect, it } from 'vitest'
import { closurePct, computeKpi, formalPct, grievancePct, grievanceTier, kpiStatus, submissionPct } from './kpi'
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
  it('accommodation falls back to the audit score', () => {
    expect(computeKpi({ kpi: kpi(), tickets: [], month: '2026-10', auditPct: 72 }).accommodation).toBe(72)
    expect(computeKpi({ kpi: kpi({ accommodationPct: 90 }), tickets: [], month: '2026-10', auditPct: 72 }).accommodation).toBe(90)
  })
})
