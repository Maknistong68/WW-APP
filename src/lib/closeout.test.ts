import { describe, expect, it } from 'vitest'
import { closeoutState, closeoutTotals, closeouts, defaultDue } from './closeout'
import type { Contractor, KpiMonth } from '../types'

const k = (p: Partial<KpiMonth>) => ({ contractorUuid: 'c', workOrderUuid: '', month: '2026-09', ...p }) as KpiMonth

describe('quarterly audit close-out', () => {
  it('due 30 days after the audit unless a date is typed', () => {
    expect(defaultDue('2026-10-01')).toBe('2026-10-31')
    expect(closeoutState(k({ auditDate: '2026-10-01', auditFindings: 4, auditClosed: 1 }), '2026-10-20')?.due).toBe('2026-10-31')
    expect(closeoutState(k({ auditDate: '2026-10-01', auditDueDate: '2026-10-10', auditFindings: 4 }), '2026-10-20')?.status).toBe('overdue')
  })
  it('status: no findings = nothing to track; open / due soon / overdue / closed', () => {
    expect(closeoutState(k({ quarterlyAuditPct: 90 }))).toBeNull()
    const st = (today: string, closed = 2) => closeoutState(k({ auditDate: '2026-09-01', auditFindings: 8, auditClosed: closed }), today)!
    expect([st('2026-09-10').status, st('2026-09-10').open]).toEqual(['open', 6])
    expect(st('2026-09-25').status).toBe('due')
    expect([st('2026-10-05').status, st('2026-10-05').daysLeft]).toEqual(['overdue', -4])
    expect([st('2026-10-05', 8).status, st('2026-10-05', 8).pct]).toEqual(['closed', 100])
  })
  it('lists overdue first and totals the findings', () => {
    const c = { uuid: 'c', name: 'RPCO', active: true, aliases: [] } as unknown as Contractor
    const s = [{ key: 'c', contractor: c, label: 'RPCO' }]
    const list = closeouts(
      s,
      [
        k({ month: '2026-07', auditDate: '2026-07-01', auditFindings: 3, auditClosed: 3 }),
        k({ month: '2026-09', auditDate: '2026-09-01', auditFindings: 5, auditClosed: 1 }),
        k({ month: '2026-08', auditFindings: 0 }),
      ],
      '2026-10-15',
    )
    expect(list.map((x) => x.status)).toEqual(['overdue', 'closed'])
    expect(closeoutTotals(list)).toMatchObject({ findings: 8, closed: 4, open: 4, overdue: 1, audits: 1 })
  })
})
