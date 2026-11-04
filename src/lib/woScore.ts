import { addMonths } from './dates'
import { kpiStatus, type KpiStatus } from './kpi'
import { kpiForSubject, type AllData } from './kpiData'
import { isDocOn } from './docRules'
import { docState, type DocState } from './submissions'
import { subjectKpi, subjectManpower, subjectPrior, type KpiSubject } from './subjects'
import type { EntryItem } from './entryItems'
import type { SubjectItemKey } from './todo'
import type { SubmissionKey } from '../types'

// ---------------------------------------------------------------------------
// One work order's KPI score as Monthly entry shows it: the month's score with
// its change against last month on the row, and the last 12 months as a line
// when the row is held.
// ---------------------------------------------------------------------------

export interface WoScore {
  /** 0–100, rounded; null = no score this month. */
  pct: number | null
  status: KpiStatus
  /** Points up or down against last month; null when either month has no score. */
  change: number | null
}

const pctOf = (d: AllData, s: KpiSubject, month: string): number | null => {
  const overall = kpiForSubject(d, s, month).overall
  return overall === null ? null : Math.round(overall)
}

export function woScore(d: AllData, s: KpiSubject, month: string): WoScore {
  const pct = pctOf(d, s, month)
  const before = pct === null ? null : pctOf(d, s, addMonths(month, -1))
  return { pct, status: kpiStatus(pct), change: pct !== null && before !== null ? pct - before : null }
}

/** Where a document stood in a month; "none" = not tracked yet (before it was first answered), "off" = switched off. */
export type MonthDoc = DocState | 'none' | 'off'

export interface ItemHistory {
  /** pct: a KPI score; count: workers; doc: a monthly document. */
  kind: 'pct' | 'count' | 'doc'
  months: string[]
  /** pct / count: the value each month (null = nothing entered). */
  values: (number | null)[]
  avg: number | null
  /** doc: its state each month. */
  states?: MonthDoc[]
  counts?: { in: number; notProvided: number; awaited: number }
}

const lastMonths = (month: string, n: number) => Array.from({ length: n }, (_, i) => addMonths(month, i - n + 1))
const average = (values: (number | null)[]) => {
  const v = values.filter((x): x is number => x !== null)
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null
}

/** One Monthly entry item for one work order over the last `n` months, oldest first (By item, held). */
export function itemHistory(d: AllData, s: KpiSubject, month: string, item: EntryItem, n = 12): ItemHistory {
  const months = lastMonths(month, n)
  if (item.kind === 'workers') {
    const values = months.map((m) => subjectManpower(s, d.manpower, m)?.totalWorkers ?? null)
    return { kind: 'count', months, values, avg: average(values) }
  }
  if (item.kind !== 'doc') {
    const key = item.check as Exclude<SubjectItemKey, 'submission'>
    const values = months.map((m) => {
      const v = kpiForSubject(d, s, m)[key]
      return v === null ? null : Math.round(v)
    })
    return { kind: 'pct', months, values, avg: average(values) }
  }
  const key = item.key as SubmissionKey
  // the month's own answer (nothing carried): tracking starts with the first one
  const answered = months.map((m) => docState(subjectKpi(s, d.kpis, m), key) !== 'awaited')
  const first = answered.indexOf(true)
  const states = months.map((m, i): MonthDoc => {
    if (!isDocOn(key, m)) return 'off'
    if (first === -1 || i < first) return 'none'
    return docState(subjectKpi(s, d.kpis, m), key, subjectPrior(s, d.kpis, m))
  })
  const count = (st: MonthDoc) => states.filter((x) => x === st).length
  return { kind: 'doc', months, values: [], avg: null, states, counts: { in: count('in'), notProvided: count('notProvided'), awaited: count('awaited') } }
}

/** The last `n` months ending at `month`, oldest first (null where there is no score), and their average. */
export function woHistory(d: AllData, s: KpiSubject, month: string, n = 12): { months: string[]; values: (number | null)[]; avg: number | null } {
  const months = lastMonths(month, n)
  const values = months.map((m) => pctOf(d, s, m))
  return { months, values, avg: average(values) }
}
