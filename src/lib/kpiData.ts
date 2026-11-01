import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { getTemplate } from '../templates'
import { scoreInspection } from './score'
import { KPI_PARTS, computeKpi, kpiStatus, type KpiResult } from './kpi'
import { mentions } from './names'
import { kpiSubjects, subjectKpi, subjectManpower, subjectTickets, type KpiSubject } from './subjects'
import type { Camp, Contractor, Inspection, KpiMonth, Manpower, Ticket, WeeklyCount, WorkOrder } from '../types'

export interface AllData {
  loaded: boolean
  contractors: Contractor[]
  byUuid: Map<string, Contractor>
  workOrders: WorkOrder[]
  woByUuid: Map<string, WorkOrder>
  camps: Camp[]
  tickets: Ticket[]
  kpis: KpiMonth[]
  manpower: Manpower[]
  weekly: WeeklyCount[]
  inspections: Inspection[]
}

type Raw = Omit<AllData, 'loaded' | 'byUuid' | 'woByUuid'>
/** The last result, so a screen opened later shows data on its first frame
 *  (screen transitions snapshot that frame; Back restores scroll into it). */
let lastRaw: Raw | undefined

/** Everything the Today / Dashboard / Contractors screens read, live. */
export function useAllData(): AllData {
  const raw = useLiveQuery(async (): Promise<Raw> => {
    const r: Raw = {
      contractors: await db.contractors.orderBy('name').toArray(),
      workOrders: await db.workOrders.toArray(),
      camps: await db.camps.toArray(),
      tickets: await db.tickets.toArray(),
      kpis: await db.kpiMonths.toArray(),
      manpower: await db.manpower.toArray(),
      weekly: await db.weeklyCounts.toArray(),
      inspections: await db.inspections.toArray(),
    }
    lastRaw = r
    return r
  }, [], lastRaw)
  return useMemo(() => {
    const d = raw ?? { contractors: [], workOrders: [], camps: [], tickets: [], kpis: [], manpower: [], weekly: [], inspections: [] }
    const workOrders = [...d.workOrders].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
    return {
      ...d,
      workOrders,
      loaded: !!raw,
      byUuid: new Map(d.contractors.map((c) => [c.uuid, c])),
      woByUuid: new Map(workOrders.map((w) => [w.uuid, w])),
    }
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

export interface SubjectKpi {
  subject: KpiSubject
  result: KpiResult
}

/** KPI result for one subject (work order or contractor) and month. */
export function kpiForSubject(d: AllData, s: KpiSubject, month: string): KpiResult {
  return computeKpi({
    kpi: subjectKpi(s, d.kpis, month),
    manpower: subjectManpower(s, d.manpower, month),
    tickets: subjectTickets(s, d.tickets, d.workOrders),
    month,
    auditPct: auditPctFor(s.contractor, d.inspections, month),
  })
}

/** Every KPI subject's result for a month. */
export function subjectKpis(d: AllData, month: string): SubjectKpi[] {
  return kpiSubjects(d.contractors, d.workOrders).map((subject) => ({ subject, result: kpiForSubject(d, subject, month) }))
}

const mean = (vals: (number | null)[]) => {
  const v = vals.filter((x): x is number => x !== null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

/** Contractor score = average of its work orders (or its own subject). */
export function rollup(results: KpiResult[]): KpiResult {
  const out = {} as Record<string, number | null>
  for (const p of KPI_PARTS) out[p.key] = mean(results.map((r) => r[p.key]))
  const overall = mean(results.map((r) => r.overall))
  return { ...(out as unknown as KpiResult), overall, status: kpiStatus(overall) }
}

/** KPI result per contractor for one month (contractors with no active subject get "No data"). */
export function kpisForMonth(d: AllData, month: string): Map<string, KpiResult> {
  const subjects = subjectKpis(d, month)
  const out = new Map<string, KpiResult>()
  for (const c of d.contractors) {
    out.set(c.uuid, rollup(subjects.filter((s) => s.subject.contractor.uuid === c.uuid).map((s) => s.result)))
  }
  return out
}

export interface KpiItemStats {
  avg: number | null
  good: number
  warn: number
  bad: number
  none: number
}

/** One KPI item across subjects: average and how many on track / at risk / critical. */
export type KpiItemKey = (typeof KPI_PARTS)[number]['key'] | 'overall'

export function itemStats(rows: SubjectKpi[], key: KpiItemKey): KpiItemStats {
  const st: KpiItemStats = { avg: mean(rows.map((r) => r.result[key])), good: 0, warn: 0, bad: 0, none: 0 }
  for (const r of rows) st[kpiStatus(r.result[key])]++
  return st
}
