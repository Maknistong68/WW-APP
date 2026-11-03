import { hasAudit, withoutAudit } from './closeout'
import type { KpiMonth, Manpower } from '../types'

// A panel (or one Monthly entry row) saves only the fields it changed, written
// over a fresh copy of the record: what a teammate — or the documents panel —
// saved while it was open is kept. Changed = different from the copy the panel
// opened with.

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** `fresh`, with every one of `fields` that differs between `opened` and `edited` taken from `edited`. */
export function mergeEdited<T extends object>(fresh: T, opened: T, edited: T, fields: readonly (keyof T)[]): T {
  const out = { ...fresh }
  for (const f of fields) {
    if (same(opened[f], edited[f])) continue
    if (edited[f] === undefined) delete out[f]
    else out[f] = edited[f]
  }
  return out
}

/** The monthly scores a KPI panel edits (offboarding's older counts and `legacy` move with it). */
export const KPI_SCORE_FIELDS = ['accommodationPct', 'onboardingPct', 'offboardingPct', 'offboarded', 'offboardTotal', 'meetingPct', 'legacy'] as const satisfies readonly (keyof KpiMonth)[]

/** The quarterly audit's fields. */
export const KPI_AUDIT_FIELDS = ['quarterlyAuditPct', 'auditDate', 'auditFindings', 'auditClosed', 'auditDueDate'] as const satisfies readonly (keyof KpiMonth)[]

/** The manpower counts. */
export const MANPOWER_FIELDS = ['totalWorkers', 'illegalOrFreelance', 'visaExpiring30d', 'paidRecruitmentFees'] as const satisfies readonly (keyof Manpower)[]

/**
 * The KPI panel's save over a fresh copy: the scores and audit fields changed
 * in it. With the audit switched off, the audit is cleared only if the panel
 * opened with one (it was switched off here); a teammate's audit is kept.
 * The documents are never touched (they have their own panel).
 */
export function applyKpiChanges(fresh: KpiMonth, opened: KpiMonth, edited: KpiMonth, auditOn: boolean): KpiMonth {
  const out = mergeEdited(fresh, opened, edited, KPI_SCORE_FIELDS)
  if (auditOn) return mergeEdited(out, opened, edited, KPI_AUDIT_FIELDS)
  return hasAudit(opened) ? withoutAudit(out) : out
}
