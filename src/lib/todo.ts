import { addMonths, monthLabel } from './dates'
import { submissionsComplete } from './kpi'
import { auditPctFor, type AllData } from './kpiData'
import { kpiSubjects, subjectKpi, subjectManpower, type KpiSubject } from './subjects'
import { closeoutState } from './closeout'

// The per-work-order checklist (WPS / manpower / salary, accommodation, …):
// what counts as entered for a month. Home's task list (src/lib/tasks.ts) and
// the "still missing" lists (/missing/:item) both read it.

/** The three months of the quarter that `month` falls in. */
export function quarterMonths(month: string): string[] {
  const q = Math.floor((Number(month.slice(5, 7)) - 1) / 3)
  const first = `${month.slice(0, 4)}-${String(q * 3 + 1).padStart(2, '0')}`
  return [first, addMonths(first, 1), addMonths(first, 2)]
}

/** Items entered per work order each month; their Home tile opens the "still missing" list. */
export type SubjectItemKey = 'submission' | 'accommodation' | 'onboarding' | 'offboarding' | 'formal' | 'meeting' | 'quarterly'

export interface SubjectItem {
  title: string
  /** Which sheet fills it in. */
  sheet: 'kpi' | 'manpower'
  done: (d: AllData, s: KpiSubject, month: string) => boolean
  /** What is entered so far, e.g. "92%" or "WPS · Salary". */
  value: (d: AllData, s: KpiSubject, month: string) => string
}

const kpiOf = (d: AllData, s: KpiSubject, month: string) => subjectKpi(s, d.kpis, month)
const pctText = (v: number | null | undefined) => (v === null || v === undefined ? '' : `${Math.round(v)}%`)

export const SUBJECT_ITEMS: Record<SubjectItemKey, SubjectItem> = {
  submission: {
    title: 'Monthly submission',
    sheet: 'kpi',
    done: (d, s, m) => submissionsComplete(kpiOf(d, s, m)),
    value: (d, s, m) => {
      const k = kpiOf(d, s, m)
      const missing = [!k?.wps && 'WPS', !k?.manpowerDecl && 'Manpower', !k?.salaryDecl && 'Salary'].filter(Boolean)
      return missing.length === 3 ? '' : missing.length ? `Missing ${missing.join(', ')}` : 'All 3 in'
    },
  },
  accommodation: {
    title: 'Accommodation %',
    sheet: 'kpi',
    done: (d, s, m) => kpiOf(d, s, m)?.accommodationPct != null || auditPctFor(s.contractor, d.inspections, m) !== null,
    value: (d, s, m) => {
      const typed = kpiOf(d, s, m)?.accommodationPct
      if (typed != null) return pctText(typed)
      const audit = auditPctFor(s.contractor, d.inspections, m)
      return audit === null ? '' : `${pctText(audit)} from audit`
    },
  },
  onboarding: {
    title: 'Onboarding %',
    sheet: 'kpi',
    done: (d, s, m) => kpiOf(d, s, m)?.onboardingPct != null,
    value: (d, s, m) => pctText(kpiOf(d, s, m)?.onboardingPct),
  },
  offboarding: {
    title: 'Offboarding',
    sheet: 'kpi',
    done: (d, s, m) => {
      const k = kpiOf(d, s, m)
      return !!k && (k.offboardTotal != null || k.legacy?.offboardingPct != null)
    },
    value: (d, s, m) => {
      const k = kpiOf(d, s, m)
      if (k?.offboardTotal != null) return `${k.offboarded ?? 0} of ${k.offboardTotal} on time`
      return pctText(k?.legacy?.offboardingPct)
    },
  },
  formal: {
    title: 'Formal vs illegal workers',
    sheet: 'manpower',
    done: (d, s, m) => {
      const mp = subjectManpower(s, d.manpower, m)
      return (!!mp && mp.totalWorkers > 0) || kpiOf(d, s, m)?.legacy?.formalPct != null
    },
    value: (d, s, m) => {
      const mp = subjectManpower(s, d.manpower, m)
      if (mp && mp.totalWorkers > 0) return `${mp.totalWorkers} workers · ${mp.illegalOrFreelance} illegal`
      return pctText(kpiOf(d, s, m)?.legacy?.formalPct)
    },
  },
  meeting: {
    title: 'Meeting attendance',
    sheet: 'kpi',
    done: (d, s, m) => kpiOf(d, s, m)?.meetingPct != null,
    value: (d, s, m) => pctText(kpiOf(d, s, m)?.meetingPct),
  },
  quarterly: {
    title: 'Quarterly audit',
    sheet: 'kpi',
    done: (d, s, m) => quarterMonths(m).some((q) => kpiOf(d, s, q)?.quarterlyAuditPct != null),
    value: (d, s, m) => {
      const hit = quarterMonths(m).find((q) => kpiOf(d, s, q)?.quarterlyAuditPct != null)
      if (!hit) return ''
      const co = closeoutState(kpiOf(d, s, hit))
      return [pctText(kpiOf(d, s, hit)?.quarterlyAuditPct), monthLabel(hit), co && `${co.closed}/${co.findings} findings closed`]
        .filter(Boolean)
        .join(' · ')
    },
  },
}

export const isSubjectItem = (k: string): k is SubjectItemKey => k in SUBJECT_ITEMS

/** Every active subject for one item and month, the missing ones first. */
export function subjectRows(d: AllData, key: SubjectItemKey, month: string) {
  const item = SUBJECT_ITEMS[key]
  return kpiSubjects(d.contractors, d.workOrders)
    .map((s) => ({ s, done: item.done(d, s, month), value: item.value(d, s, month) }))
    .sort((a, b) => Number(a.done) - Number(b.done) || a.s.label.localeCompare(b.s.label))
}
