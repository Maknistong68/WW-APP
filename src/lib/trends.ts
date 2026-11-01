import { kpiForSubject, rollup, type AllData } from './kpiData'
import { kpiSubjects } from './subjects'
import type { Contractor } from '../types'

// History for one contractor, month by month. A month with no data is null
// (a gap on the chart), never 0.

/** The contractor's overall KPI for each month (its work orders averaged). */
export function contractorOverall(d: AllData, c: Contractor, months: string[]): (number | null)[] {
  const subjects = kpiSubjects([c], d.workOrders)
  if (subjects.length === 0) return months.map(() => null)
  return months.map((m) => {
    const v = rollup(subjects.map((s) => kpiForSubject(d, s, m))).overall
    return v === null ? null : Math.round(v)
  })
}
