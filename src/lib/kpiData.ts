import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { TEAM_SETTINGS_UUID, setDocRules } from './docRules'
import { splitTickets } from './cases'
import { inspectionPct } from './inspectionScore'
import { KPI_PARTS, computeKpi, kpiStatus, type KpiResult } from './kpi'
import { mentions } from './names'
import { kpiSubjects, subjectKpi, subjectManpower, subjectTickets, type KpiSubject } from './subjects'
import type { Camp, Contractor, DocRule, Inspection, KpiMonth, Manpower, Ticket, WeeklyCount, WorkOrder } from '../types'

export interface AllData {
  loaded: boolean
  contractors: Contractor[]
  byUuid: Map<string, Contractor>
  workOrders: WorkOrder[]
  woByUuid: Map<string, WorkOrder>
  camps: Camp[]
  /** D&C tickets only: these feed the KPIs and every number labelled "tickets". */
  tickets: Ticket[]
  /** The team's own cases (src/lib/cases.ts), shown only where labelled "Cases". */
  cases: Ticket[]
  kpis: KpiMonth[]
  manpower: Manpower[]
  weekly: WeeklyCount[]
  inspections: Inspection[]
  /** Monthly documents switched off (Settings › Monthly documents); here so screens recompute when it changes. */
  docRules?: DocRule[]
}

/** What the database holds: every ticket together, D&C and cases. */
type Raw = Omit<AllData, 'loaded' | 'byUuid' | 'woByUuid' | 'cases'>
/** The last result, so a screen opened later shows data on its first frame
 *  (screen transitions snapshot that frame; Back restores scroll into it). */
let lastRaw: Raw | undefined

const EMPTY: Raw = { contractors: [], workOrders: [], camps: [], tickets: [], kpis: [], manpower: [], weekly: [], inspections: [] }

/** AllData from the stored rows: work orders in number order, tickets split into D&C and cases. */
export function shapeAllData(raw: Raw, loaded: boolean): AllData {
  const workOrders = [...raw.workOrders].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
  const { tickets, cases } = splitTickets(raw.tickets)
  return {
    ...raw,
    workOrders,
    tickets,
    cases,
    loaded,
    byUuid: new Map(raw.contractors.map((c) => [c.uuid, c])),
    woByUuid: new Map(workOrders.map((w) => [w.uuid, w])),
  }
}

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
      docRules: (await db.teamSettings.get(TEAM_SETTINGS_UUID))?.docRules ?? [],
    }
    // every list and score asks the store (src/lib/docRules.ts): keep it in step before screens compute
    setDocRules(r.docRules)
    lastRaw = r
    return r
  }, [], lastRaw)
  return useMemo(() => shapeAllData(raw ?? EMPTY, !!raw), [raw])
}

/** Score of the contractor's latest audit reviewed in the month, if any. */
export function auditPctFor(c: Contractor, inspections: Inspection[], month: string, camps: Camp[] = []): number | null {
  const names = [c.name, ...c.aliases]
  const own = new Set(camps.filter((k) => k.contractorUuid === c.uuid).map((k) => k.uuid))
  // Drafts never count: only a finished inspection is a score.
  const hits = inspections
    .filter(
      (i) =>
        i.status === 'completed' &&
        i.info?.reviewDate?.startsWith(month) &&
        ((!!i.campUuid && own.has(i.campUuid)) || mentions(i.info?.contractorNames ?? '', names)),
    )
    .sort((a, b) => b.info.reviewDate.localeCompare(a.info.reviewDate))
  for (const ins of hits) {
    const pct = inspectionPct(ins)
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
    auditPct: auditPctFor(s.contractor, d.inspections, month, d.camps),
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
