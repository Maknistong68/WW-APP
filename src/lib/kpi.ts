import { daysBetween, monthRange } from './dates'
import type { KpiMonth, Manpower, Ticket } from '../types'

// Every KPI rule in one place (spec §5). All values are 0–100, null = blank
// (no data), and blanks are left out of the overall average.

export type KpiStatus = 'good' | 'warn' | 'bad' | 'none'

export interface KpiResult {
  submission: number | null
  accommodation: number | null
  onboarding: number | null
  offboarding: number | null
  grievance: number | null
  formal: number | null
  closure: number | null
  meeting: number | null
  /** Shown, never averaged (same as the Excel). */
  quarterly: number | null
  overall: number | null
  status: KpiStatus
}

export const KPI_PARTS: { key: Exclude<keyof KpiResult, 'overall' | 'status'>; label: string; auto?: boolean }[] = [
  { key: 'submission', label: 'Monthly submission' },
  { key: 'accommodation', label: 'Accommodation' },
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'offboarding', label: 'Offboarding' },
  { key: 'grievance', label: 'Grievance', auto: true },
  { key: 'formal', label: 'Formal vs illegal', auto: true },
  { key: 'closure', label: 'Ticket closure', auto: true },
  { key: 'meeting', label: 'Meeting attendance' },
  { key: 'quarterly', label: 'Quarterly audit' },
]

/** WPS + manpower + salary declarations: all 3 = 100, none = 0, else 50. */
export function submissionPct(k: Pick<KpiMonth, 'wps' | 'manpowerDecl' | 'salaryDecl'>): number {
  const yes = [k.wps, k.manpowerDecl, k.salaryDecl].filter(Boolean).length
  return yes === 3 ? 100 : yes === 0 ? 0 : 50
}

export function offboardingPct(k: Pick<KpiMonth, 'offboarded' | 'offboardTotal'>): number | null {
  if (!k.offboardTotal || k.offboarded === null) return null
  return Math.min(100, (k.offboarded / k.offboardTotal) * 100)
}

export function formalPct(m: Pick<Manpower, 'totalWorkers' | 'illegalOrFreelance'> | undefined): number | null {
  if (!m || !m.totalWorkers) return null
  return Math.max(0, ((m.totalWorkers - m.illegalOrFreelance) / m.totalWorkers) * 100)
}

/** Tier score for an average closing time in days. */
export function grievanceTier(avgDays: number): number {
  if (avgDays <= 10) return 100
  if (avgDays <= 15) return 90
  if (avgDays <= 20) return 80
  if (avgDays <= 30) return 70
  return 0
}

const closedIn = (t: Ticket, start: string, end: string) =>
  t.status === 'Closed' && !!t.closedAt && t.closedAt >= start && t.closedAt <= end

/** Grievance %: average days-to-close of tickets closed in the month. */
export function grievancePct(tickets: Ticket[], month: string): number | null {
  const { start, end } = monthRange(month)
  const closed = tickets.filter((t) => closedIn(t, start, end))
  if (closed.length === 0) return null
  const avg = closed.reduce((s, t) => s + daysBetween(t.openedAt, t.closedAt), 0) / closed.length
  return grievanceTier(avg)
}

/**
 * Ticket closure %: closed in the month ÷ open at any point in the month
 * (opened by month end, and not closed before the month started). Closed
 * tickets with no closing date can't be placed in time and are ignored.
 */
export function closurePct(tickets: Ticket[], month: string): number | null {
  const { start, end } = monthRange(month)
  const during = tickets.filter((t) => {
    if (!t.openedAt || t.openedAt > end) return false
    if (t.status !== 'Closed') return true
    return !!t.closedAt && t.closedAt >= start
  })
  if (during.length === 0) return null
  return (during.filter((t) => closedIn(t, start, end)).length / during.length) * 100
}

export function kpiStatus(overall: number | null): KpiStatus {
  if (overall === null) return 'none'
  return overall >= 90 ? 'good' : overall >= 70 ? 'warn' : 'bad'
}

export const STATUS_LABEL: Record<KpiStatus, string> = {
  good: 'On track',
  warn: 'At risk',
  bad: 'Critical',
  none: 'No data',
}

/**
 * All KPIs for one contractor-month. `tickets` must already be this
 * contractor's tickets. `auditPct` fills Accommodation when it isn't typed.
 */
export function computeKpi(input: {
  kpi?: KpiMonth
  manpower?: Manpower
  tickets: Ticket[]
  month: string
  auditPct?: number | null
}): KpiResult {
  const { kpi, manpower, tickets, month } = input
  const r: Omit<KpiResult, 'overall' | 'status'> = {
    submission: kpi ? submissionPct(kpi) : null,
    accommodation: kpi?.accommodationPct ?? input.auditPct ?? null,
    onboarding: kpi?.onboardingPct ?? null,
    offboarding: (kpi ? offboardingPct(kpi) : null) ?? kpi?.legacy?.offboardingPct ?? null,
    grievance: grievancePct(tickets, month),
    formal: formalPct(manpower) ?? kpi?.legacy?.formalPct ?? null,
    closure: closurePct(tickets, month),
    meeting: kpi?.meetingPct ?? null,
    quarterly: kpi?.quarterlyAuditPct ?? null,
  }
  const parts = [r.submission, r.accommodation, r.onboarding, r.offboarding, r.grievance, r.formal, r.closure, r.meeting]
  const vals = parts.filter((v): v is number => v !== null)
  const overall = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
  return { ...r, overall, status: kpiStatus(overall) }
}

/** Submissions complete for the month (WPS, manpower and salary all in). */
export const submissionsComplete = (k: KpiMonth | undefined) => !!k && k.wps && k.manpowerDecl && k.salaryDecl

export const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${Math.round(v)}%`)
