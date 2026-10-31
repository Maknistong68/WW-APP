import { addDays, daysDiff, localDate } from './dates'
import { woOf, type KpiSubject } from './subjects'
import type { KpiMonth } from '../types'

// Quarterly audit close-out: the score is a percentage; the findings it
// raised are tracked as counts (found / closed) against a due date.

/** Close-out is due this many days after the audit unless changed. */
export const CLOSEOUT_DAYS = 30
/** "Due soon" = this many days or fewer left. */
export const CLOSEOUT_SOON_DAYS = 7

export const defaultDue = (auditDate: string) => (auditDate ? addDays(auditDate, CLOSEOUT_DAYS) : '')

export type CloseoutStatus = 'overdue' | 'due' | 'open' | 'closed'

export interface CloseoutState {
  findings: number
  closed: number
  open: number
  /** Share closed, 0–100. */
  pct: number
  due: string
  /** Days until due (negative = overdue); null without a due date. */
  daysLeft: number | null
  status: CloseoutStatus
}

/** Close-out state of one KPI month, or null when the audit raised no findings. */
export function closeoutState(k: KpiMonth | undefined, today = localDate()): CloseoutState | null {
  const findings = k?.auditFindings ?? 0
  if (!k || findings <= 0) return null
  const closed = Math.min(findings, Math.max(0, k.auditClosed ?? 0))
  const due = k.auditDueDate || defaultDue(k.auditDate ?? '')
  const daysLeft = due ? daysDiff(today, due) : null
  const status: CloseoutStatus =
    closed >= findings
      ? 'closed'
      : daysLeft !== null && daysLeft < 0
        ? 'overdue'
        : daysLeft !== null && daysLeft <= CLOSEOUT_SOON_DAYS
          ? 'due'
          : 'open'
  return { findings, closed, open: findings - closed, pct: (closed / findings) * 100, due, daysLeft, status }
}

export interface Closeout extends CloseoutState {
  subject: KpiSubject
  kpi: KpiMonth
}

const RANK: Record<CloseoutStatus, number> = { overdue: 0, due: 1, open: 2, closed: 3 }

/** Every audit with findings for the active work orders: overdue first, closed last (newest first). */
export function closeouts(subjects: KpiSubject[], kpis: KpiMonth[], today = localDate()): Closeout[] {
  const out: Closeout[] = []
  for (const s of subjects) {
    for (const k of kpis) {
      if (k.contractorUuid !== s.contractor.uuid || (k.workOrderUuid || '') !== woOf(s)) continue
      const st = closeoutState(k, today)
      if (st) out.push({ ...st, subject: s, kpi: k })
    }
  }
  return out.sort(
    (a, b) =>
      RANK[a.status] - RANK[b.status] ||
      (a.status === 'closed' ? b.kpi.month.localeCompare(a.kpi.month) : (a.daysLeft ?? 1e9) - (b.daysLeft ?? 1e9)),
  )
}

/** Totals for the dashboard. */
export function closeoutTotals(list: Closeout[]) {
  const findings = list.reduce((s, c) => s + c.findings, 0)
  const closed = list.reduce((s, c) => s + c.closed, 0)
  return {
    findings,
    closed,
    open: findings - closed,
    pct: findings ? (closed / findings) * 100 : null,
    overdue: list.filter((c) => c.status === 'overdue').length,
    due: list.filter((c) => c.status === 'due').length,
    audits: list.filter((c) => c.status !== 'closed').length,
  }
}

/** "5 of 8 closed · due 12 Nov · 3d overdue" */
export function closeoutText(c: CloseoutState, short: (ymd: string) => string): string {
  const parts = [c.status === 'closed' ? `All ${c.findings} closed` : `${c.closed} of ${c.findings} closed`]
  if (c.status !== 'closed' && c.due) {
    parts.push(`due ${short(c.due)}`)
    if (c.daysLeft !== null) parts.push(c.daysLeft < 0 ? `${-c.daysLeft}d overdue` : c.daysLeft === 0 ? 'due today' : `${c.daysLeft}d left`)
  }
  return parts.join(' · ')
}
