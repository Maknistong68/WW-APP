import { addMonths, monthLabel } from './dates'
import { meetingAttended, offboardingScore } from './kpi'
import { auditPctFor, type AllData } from './kpiData'
import { kpiSubjects, subjectKpi, subjectManpower, subjectPrior, type KpiSubject } from './subjects'
import { SUBMISSION_ITEMS as DOCS, allSettled, awaitedItems, docState, docText, shortList, submissionCounts } from './submissions'
import type { SubmissionKey } from '../types'
import { closeoutState } from './closeout'

// The per-work-order checklist (the monthly documents, accommodation, …):
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
  sheet: 'kpi' | 'manpower' | 'submission'
  done: (d: AllData, s: KpiSubject, month: string) => boolean
  /** What is entered so far, e.g. "92%" or "WPS · Salary". */
  value: (d: AllData, s: KpiSubject, month: string) => string
}

const kpiOf = (d: AllData, s: KpiSubject, month: string) => subjectKpi(s, d.kpis, month)
const pctText = (v: number | null | undefined) => (v === null || v === undefined ? '' : `${Math.round(v)}%`)

export const SUBJECT_ITEMS: Record<SubjectItemKey, SubjectItem> = {
  submission: {
    title: 'Monthly documents',
    sheet: 'submission',
    // Done once nothing is waiting: each one in, not provided, or not applicable.
    done: (d, s, m) => allSettled(kpiOf(d, s, m), subjectPrior(s, d.kpis, m)),
    value: (d, s, m) => {
      const k = kpiOf(d, s, m)
      const prior = subjectPrior(s, d.kpis, m)
      const c = submissionCounts(k, prior)
      const notProvided = DOCS.filter((i) => docState(k, i.key, prior) === 'notProvided')
      if (!c.in && !notProvided.length) return ''
      const waiting = awaitedItems(k, prior)
      const parts = [`${c.in} of ${c.required} in`, waiting.length && `Missing ${shortList(waiting)}`, notProvided.length && `${shortList(notProvided)} not provided`]
      return parts.filter(Boolean).join(' · ')
    },
  },
  accommodation: {
    title: 'Accommodation %',
    sheet: 'kpi',
    done: (d, s, m) => kpiOf(d, s, m)?.accommodationPct != null || auditPctFor(s.contractor, d.inspections, m, d.camps) !== null,
    value: (d, s, m) => {
      const typed = kpiOf(d, s, m)?.accommodationPct
      if (typed != null) return pctText(typed)
      const audit = auditPctFor(s.contractor, d.inspections, m, d.camps)
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
    title: 'Offboarding %',
    sheet: 'kpi',
    // Older months with a total of 0 (nobody offboarded) count as entered.
    done: (d, s, m) => {
      const k = kpiOf(d, s, m)
      return offboardingScore(k) !== null || k?.offboardTotal != null
    },
    value: (d, s, m) => pctText(offboardingScore(kpiOf(d, s, m))),
  },
  formal: {
    title: 'Formal vs illegal workers',
    sheet: 'manpower',
    done: (d, s, m) => {
      const mp = subjectManpower(s, d.manpower, m)
      // A saved count is an answer, even 0 workers (a work order winding down).
      return !!mp || kpiOf(d, s, m)?.legacy?.formalPct != null
    },
    value: (d, s, m) => {
      const mp = subjectManpower(s, d.manpower, m)
      if (mp) return mp.totalWorkers > 0 ? `${mp.totalWorkers} workers · ${mp.illegalOrFreelance} illegal` : 'No workers'
      return pctText(kpiOf(d, s, m)?.legacy?.formalPct)
    },
  },
  meeting: {
    title: 'Meeting attendance',
    sheet: 'kpi',
    done: (d, s, m) => kpiOf(d, s, m)?.meetingPct != null,
    value: (d, s, m) => {
      const attended = meetingAttended(kpiOf(d, s, m)?.meetingPct)
      return attended === null ? '' : attended ? 'Attended' : 'Not attended'
    },
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

/**
 * The documents list (/missing/submission): every work order with what is
 * still missing, or with `only`, whether each has sent that one document.
 */
export function docRows(d: AllData, month: string, only?: SubmissionKey) {
  return kpiSubjects(d.contractors, d.workOrders)
    .map((s) => {
      const k = subjectKpi(s, d.kpis, month)
      const prior = subjectPrior(s, d.kpis, month)
      const waiting = awaitedItems(k, prior)
      return only
        ? { s, done: docState(k, only, prior) !== 'awaited', value: docText(k, only, prior), waiting }
        : { s, done: !waiting.length, value: SUBJECT_ITEMS.submission.value(d, s, month), waiting }
    })
    .sort((a, b) => Number(a.done) - Number(b.done) || a.s.label.localeCompare(b.s.label, undefined, { numeric: true }))
}

/** How many work orders still owe each document this month. */
export function docMissing(d: AllData, month: string): Record<SubmissionKey, number> {
  const out = Object.fromEntries(DOCS.map((i) => [i.key, 0])) as Record<SubmissionKey, number>
  for (const r of docRows(d, month)) for (const i of r.waiting) out[i.key] += 1
  return out
}
