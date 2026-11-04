import { daysBetween, localDate, monthRange } from './dates'
import { isDocOn } from './docRules'
import type { DeclField, KpiMonth, Manpower, Ticket } from '../types'

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

export const DECLARATIONS: { key: DeclField; label: string; short: string }[] = [
  { key: 'wps', label: 'WPS certificate', short: 'WPS' },
  { key: 'manpowerDecl', label: 'Manpower register', short: 'Manpower' },
  { key: 'salaryDecl', label: 'Salary declaration', short: 'Salary' },
]

/** One declaration: in (true), not provided — the contractor can't give it (false), or still awaited (null). */
export function declState(k: KpiMonth | undefined, f: DeclField): boolean | null {
  if (k?.[f]) return true
  return k?.notProvided?.includes(f) ? false : null
}

/** Answer one declaration; "not provided" keeps the list in form order and drops it when empty. */
export function setDecl(k: KpiMonth, f: DeclField, v: boolean | null): KpiMonth {
  const out: KpiMonth = { ...k, [f]: v === true }
  const list = DECLARATIONS.map((d) => d.key).filter((x) => (x === f ? v === false : k.notProvided?.includes(x)))
  if (list.length) out.notProvided = list
  else delete out.notProvided
  return out
}

/** The declarations asked for in a month (the Admin can switch one off: Settings › Monthly documents). */
const declsFor = (month?: string) => DECLARATIONS.filter((d) => isDocOn(d.key, month))

/** Declarations still awaited (neither in nor marked not provided). */
export const declWaiting = (k: KpiMonth | undefined) => declsFor(k?.month).filter((d) => declState(k, d.key) === null)
/** Declarations marked not provided. */
export const declNotProvided = (k: KpiMonth | undefined) => declsFor(k?.month).filter((d) => declState(k, d.key) === false)

/**
 * WPS + manpower + salary declarations: all in = 100, none = 0, else 50. Ones the
 * contractor can't provide, and ones switched off for the month, are left out;
 * if none is left it's blank.
 */
export function submissionPct(k: KpiMonth): number | null {
  const due = declsFor(k.month).filter((d) => declState(k, d.key) !== false)
  if (due.length === 0) return null
  const yes = due.filter((d) => k[d.key]).length
  return yes === due.length ? 100 : yes === 0 ? 0 : 50
}

/** Older months: offboarded on time ÷ total offboarded. */
export function offboardingPct(k: Pick<KpiMonth, 'offboarded' | 'offboardTotal'>): number | null {
  if (!k.offboardTotal || k.offboarded == null) return null
  return Math.min(100, (k.offboarded / k.offboardTotal) * 100)
}

/** Offboarding %: the typed score; older months fall back to their counts, then the Excel %. */
export function offboardingScore(k: KpiMonth | undefined): number | null {
  if (!k) return null
  return k.offboardingPct ?? offboardingPct(k) ?? k.legacy?.offboardingPct ?? null
}

/** Type the offboarding score, dropping older counts so they can't show through a cleared score. */
export function setOffboarding(k: KpiMonth, v: number | null): KpiMonth {
  const out: KpiMonth = { ...k, offboardingPct: v }
  delete out.offboarded
  delete out.offboardTotal
  if (out.legacy?.offboardingPct != null) out.legacy = { ...out.legacy, offboardingPct: null }
  return out
}

/** Meeting attendance is answered yes / no and stored as 100 / 0 (null = not answered). */
export const attendedPct = (attended: boolean | null): number | null => (attended === null ? null : attended ? 100 : 0)
export const meetingAttended = (pct: number | null | undefined): boolean | null => (pct == null ? null : pct >= 50)

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
export function closurePct(tickets: Ticket[], month: string, today: string = localDate()): number | null {
  const { start, end } = monthRange(month)
  const during = tickets.filter((t) => {
    if (!t.openedAt || t.openedAt > end) return false
    if (t.status !== 'Closed') return true
    return !!t.closedAt && t.closedAt >= start
  })
  if (during.length === 0) return null
  const closed = during.filter((t) => closedIn(t, start, end)).length
  // The month is still running and nothing has closed yet: not scored yet,
  // rather than 0% (which would mark every contractor Critical on the 1st).
  if (closed === 0 && today <= end) return null
  return (closed / during.length) * 100
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
    offboarding: offboardingScore(kpi),
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

export const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${Math.round(v)}%`)
