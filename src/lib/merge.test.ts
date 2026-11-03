import { describe, expect, it } from 'vitest'
import { MANPOWER_FIELDS, applyKpiChanges, mergeEdited } from './merge'
import { setAuditDate } from './closeout'
import { setOffboarding } from './kpi'
import { emptyKpi, emptyManpower } from './subjects'
import { setDoc } from './submissions'
import type { KpiMonth } from '../types'

const oct = (p: Partial<KpiMonth> = {}): KpiMonth => ({ ...emptyKpi('c1', 'w1', '2026-10'), uuid: 'k1', ...p })

describe('A KPI panel saves only what was changed in it', () => {
  it('a teammate’s onboarding (saved while the panel was open) is kept', () => {
    const opened = oct()
    const edited = { ...opened, accommodationPct: 90 }
    const fresh = oct({ onboardingPct: 75 })
    const out = applyKpiChanges(fresh, opened, edited, false)
    expect([out.accommodationPct, out.onboardingPct]).toEqual([90, 75])
  })
  it('the documents always come from the fresh copy', () => {
    const opened = oct()
    const fresh = setDoc(oct(), 'wps', { state: 'in', on: '2026-11-02' })
    const out = applyKpiChanges(fresh, opened, { ...opened, meetingPct: 100 }, false)
    expect(out.wps).toBe(true)
    expect(out.docs?.wps?.on).toBe('2026-11-02')
  })
  it('nothing changed: the fresh copy as it is', () => {
    const fresh = oct({ onboardingPct: 75, quarterlyAuditPct: 80, auditDate: '2026-10-10' })
    expect(applyKpiChanges(fresh, oct(), oct(), false)).toEqual(fresh)
  })
  it('the audit is cleared only when it was switched off in this panel', () => {
    const opened = oct({ quarterlyAuditPct: 80, auditDate: '2026-10-10', auditFindings: 3 })
    const out = applyKpiChanges(opened, opened, opened, false)
    expect(out.quarterlyAuditPct).toBeNull()
    expect(out.auditDate).toBeUndefined()
  })
  it('a teammate’s audit survives a panel opened without one', () => {
    const fresh = oct({ quarterlyAuditPct: 85, auditDate: '2026-10-12' })
    const out = applyKpiChanges(fresh, oct(), oct({ accommodationPct: 70 }), false)
    expect([out.quarterlyAuditPct, out.auditDate, out.accommodationPct]).toEqual([85, '2026-10-12', 70])
  })
  it('with the audit on, its fields merge one by one', () => {
    const opened = oct({ quarterlyAuditPct: 80, auditFindings: 4, auditClosed: 1 })
    const fresh = { ...opened, auditClosed: 3 }
    const out = applyKpiChanges(fresh, opened, { ...opened, quarterlyAuditPct: 82 }, true)
    expect([out.quarterlyAuditPct, out.auditFindings, out.auditClosed]).toEqual([82, 4, 3])
  })
  it('typing offboarding drops the old counts', () => {
    const opened = oct({ offboarded: 3, offboardTotal: 4 })
    const out = applyKpiChanges(opened, opened, setOffboarding(opened, 95), false)
    expect(out.offboardingPct).toBe(95)
    expect('offboarded' in out || 'offboardTotal' in out).toBe(false)
  })
})

describe('The manpower panel too', () => {
  it('a teammate’s total is kept when the panel changed the illegal count', () => {
    const opened = { ...emptyManpower('c1', 'w1', '2026-10'), uuid: 'm1', totalWorkers: 100 }
    const fresh = { ...opened, totalWorkers: 120 }
    const out = mergeEdited(fresh, opened, { ...opened, illegalOrFreelance: 2 }, MANPOWER_FIELDS)
    expect([out.totalWorkers, out.illegalOrFreelance]).toEqual([120, 2])
  })
})

describe('The audit due date follows the audit date until changed by hand', () => {
  it('follows', () => {
    const k = setAuditDate(oct(), '2026-10-10')
    expect(k.auditDueDate).toBe('2026-11-09')
    expect(setAuditDate(k, '2026-10-15').auditDueDate).toBe('2026-11-14')
  })
  it('a hand-picked due date stays', () => {
    const k = { ...setAuditDate(oct(), '2026-10-10'), auditDueDate: '2026-12-01' }
    expect(setAuditDate(k, '2026-10-15').auditDueDate).toBe('2026-12-01')
  })
})
