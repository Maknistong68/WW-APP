import { kpiForSubject, type AllData, type KpiItemKey } from './kpiData'
import { kpiSubjects } from './subjects'
import { contractorKpiSeries } from './trends'

// Compare contractors (or work orders) month by month on one KPI item: the
// grid on /compare and the Dashboard's mini grid.

export type CompareBy = 'contractor' | 'workOrder'

export interface CompareRow {
  key: string
  label: string
  contractorUuid: string
  workOrderUuid?: string
  /** One value per month, null where there is no data. */
  values: (number | null)[]
  latest: number | null
  /** Change from the month with data before the latest one. */
  change: number | null
}

function row(key: string, label: string, contractorUuid: string, workOrderUuid: string | undefined, values: (number | null)[]): CompareRow {
  const known = values.filter((v): v is number => v !== null)
  const latest = known.length ? known[known.length - 1] : null
  const prev = known.length > 1 ? known[known.length - 2] : null
  return { key, label, contractorUuid, workOrderUuid, values, latest, change: latest !== null && prev !== null ? latest - prev : null }
}

/** Active contractors (or their active work orders), one value per month. */
export function compareRows(d: AllData, months: string[], key: KpiItemKey, by: CompareBy = 'contractor'): CompareRow[] {
  if (by === 'contractor') {
    return d.contractors.filter((c) => c.active).map((c) => row(c.uuid, c.name, c.uuid, undefined, contractorKpiSeries(d, c, months)[key]))
  }
  return kpiSubjects(d.contractors, d.workOrders).map((s) =>
    row(
      s.key,
      s.label,
      s.contractor.uuid,
      s.workOrder?.uuid,
      months.map((m) => {
        const v = kpiForSubject(d, s, m)[key]
        return v === null ? null : Math.round(v)
      }),
    ),
  )
}

const byName = (a: CompareRow, b: CompareRow) => a.label.localeCompare(b.label, undefined, { numeric: true })

/** Worst first by the latest month (no data last), or A–Z. */
export function sortRows(rows: CompareRow[], order: 'worst' | 'name'): CompareRow[] {
  if (order === 'name') return [...rows].sort(byName)
  return [...rows].sort((a, b) => {
    if (a.latest === null && b.latest === null) return byName(a, b)
    if (a.latest === null) return 1
    if (b.latest === null) return -1
    return a.latest - b.latest || byName(a, b)
  })
}

/** Each month's average over the rows that have a value. */
export function columnAverages(rows: CompareRow[], n: number): (number | null)[] {
  return Array.from({ length: n }, (_, i) => {
    const vals = rows.map((r) => r.values[i]).filter((v): v is number => v !== null && v !== undefined)
    return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null
  })
}
