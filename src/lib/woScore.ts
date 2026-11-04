import { addMonths } from './dates'
import { kpiStatus, type KpiStatus } from './kpi'
import { kpiForSubject, type AllData } from './kpiData'
import type { KpiSubject } from './subjects'

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

/** The last `n` months ending at `month`, oldest first (null where there is no score), and their average. */
export function woHistory(d: AllData, s: KpiSubject, month: string, n = 12): { months: string[]; values: (number | null)[]; avg: number | null } {
  const months = Array.from({ length: n }, (_, i) => addMonths(month, i - n + 1))
  const values = months.map((m) => pctOf(d, s, m))
  const scored = values.filter((v): v is number => v !== null)
  return { months, values, avg: scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null }
}
