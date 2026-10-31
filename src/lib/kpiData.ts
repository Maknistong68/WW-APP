import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { getTemplate } from '../templates'
import { scoreInspection } from './score'
import { computeKpi, type KpiResult } from './kpi'
import { mentions } from './names'
import type { Contractor, Inspection, KpiMonth, Manpower, Ticket, WeeklyCount } from '../types'

export interface AllData {
  loaded: boolean
  contractors: Contractor[]
  byUuid: Map<string, Contractor>
  tickets: Ticket[]
  kpis: KpiMonth[]
  manpower: Manpower[]
  weekly: WeeklyCount[]
  inspections: Inspection[]
}

/** Everything the Today / Dashboard / Contractors screens read, live. */
export function useAllData(): AllData {
  const raw = useLiveQuery(async () => ({
    contractors: await db.contractors.orderBy('name').toArray(),
    tickets: await db.tickets.toArray(),
    kpis: await db.kpiMonths.toArray(),
    manpower: await db.manpower.toArray(),
    weekly: await db.weeklyCounts.toArray(),
    inspections: await db.inspections.toArray(),
  }))
  return useMemo(() => {
    const d = raw ?? { contractors: [], tickets: [], kpis: [], manpower: [], weekly: [], inspections: [] }
    return { ...d, loaded: !!raw, byUuid: new Map(d.contractors.map((c) => [c.uuid, c])) }
  }, [raw])
}

/** Score of the contractor's latest audit reviewed in the month, if any. */
export function auditPctFor(c: Contractor, inspections: Inspection[], month: string): number | null {
  const names = [c.name, ...c.aliases]
  const hits = inspections
    .filter((i) => i.info?.reviewDate?.startsWith(month) && mentions(i.info?.contractorNames ?? '', names))
    .sort((a, b) => (a.info.reviewDate < b.info.reviewDate ? 1 : -1))
  for (const ins of hits) {
    const t = getTemplate(ins.templateId)
    const pct = t ? scoreInspection(t, ins).pct : null
    if (pct !== null) return pct
  }
  return null
}

/** KPI result per contractor for one month. */
export function kpisForMonth(d: AllData, month: string): Map<string, KpiResult> {
  const out = new Map<string, KpiResult>()
  for (const c of d.contractors) {
    out.set(
      c.uuid,
      computeKpi({
        kpi: d.kpis.find((k) => k.contractorUuid === c.uuid && k.month === month),
        manpower: d.manpower.find((m) => m.contractorUuid === c.uuid && m.month === month),
        tickets: d.tickets.filter((t) => t.contractorUuid === c.uuid),
        month,
        auditPct: auditPctFor(c, d.inspections, month),
      }),
    )
  }
  return out
}
