import { campInspections } from './camps'
import { dayMonth } from './dates'
import { inspectionScore } from './inspectionScore'
import type { AllData } from './kpiData'
import { mentions } from './names'
import { woOf, type KpiSubject } from './subjects'
import { quarterMonths } from './todo'
import type { Camp, Contractor, Inspection } from '../types'

// Audit history: the quarterly audit scores kept on the monthly KPI records
// (per work order), and camp inspection scores. Drafts never count.

export function quarterOf(month: string) {
  const months = quarterMonths(month)
  const q = Math.floor((Number(month.slice(5, 7)) - 1) / 3) + 1
  return { key: `${month.slice(0, 4)}-Q${q}`, label: `Q${q} ${month.slice(0, 4)}`, months }
}

export interface QuarterAuditRow {
  subject: KpiSubject
  month: string
  pct: number
  findings: number | null
  closed: number | null
}

export interface QuarterAudit {
  key: string
  label: string
  /** Average score of the work orders audited that quarter. */
  avg: number
  audited: number
  total: number
  /** The latest month in the quarter with a score (to open its list). */
  lastMonth: string
  rows: QuarterAuditRow[]
}

const round = (v: number) => Math.round(v)
const byNumber = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true })

/** Each quarter with audit scores, newest first: each work order's latest score in it. */
export function quarterlyAudits(d: AllData, subjects: KpiSubject[]): QuarterAudit[] {
  const byQuarter = new Map<string, Map<string, QuarterAuditRow>>()
  for (const s of subjects) {
    for (const k of d.kpis) {
      if (k.contractorUuid !== s.contractor.uuid || (k.workOrderUuid || '') !== woOf(s)) continue
      if (k.quarterlyAuditPct === null || k.quarterlyAuditPct === undefined) continue
      const q = quarterOf(k.month).key
      const rows = byQuarter.get(q) ?? new Map<string, QuarterAuditRow>()
      const prev = rows.get(s.key)
      if (!prev || k.month > prev.month) {
        rows.set(s.key, { subject: s, month: k.month, pct: k.quarterlyAuditPct, findings: k.auditFindings ?? null, closed: k.auditClosed ?? null })
      }
      byQuarter.set(q, rows)
    }
  }
  return [...byQuarter.entries()]
    .map(([key, rows]) => {
      const list = [...rows.values()].sort((x, y) => byNumber(x.subject.label, y.subject.label))
      const lastMonth = list.reduce((m, r) => (r.month > m ? r.month : m), '')
      return {
        key,
        label: quarterOf(lastMonth).label,
        avg: round(list.reduce((s, r) => s + r.pct, 0) / list.length),
        audited: list.length,
        total: subjects.length,
        lastMonth,
        rows: list,
      }
    })
    .sort((x, y) => (x.key < y.key ? 1 : -1))
}

export interface AuditItem {
  key: string
  kind: 'quarterly' | 'inspection'
  /** YYYY-MM for a quarterly score, YYYY-MM-DD for an inspection. */
  date: string
  title: string
  detail: string
  pct: number | null
  to: string
}

/** Completed inspections that are about this contractor: at one of its camps, or naming it. */
export function contractorInspections(d: AllData, c: Contractor): Inspection[] {
  const camps = new Set(d.camps.filter((x) => x.contractorUuid === c.uuid).map((x) => x.uuid))
  const names = [c.name, ...c.aliases]
  return d.inspections.filter(
    (i) => i.status === 'completed' && i.info?.reviewDate && ((i.campUuid && camps.has(i.campUuid)) || mentions(i.info.contractorNames ?? '', names)),
  )
}

const findingsText = (n: number) => (n ? `${n} finding${n === 1 ? '' : 's'}` : 'No findings')

/** A contractor's audits: a score per month (null when none) and a list, newest first. */
export function contractorAudits(d: AllData, c: Contractor, months: string[]) {
  const list: AuditItem[] = []
  for (const k of d.kpis) {
    if (k.contractorUuid !== c.uuid || k.quarterlyAuditPct === null || k.quarterlyAuditPct === undefined) continue
    const wo = k.workOrderUuid ? d.woByUuid.get(k.workOrderUuid) : undefined
    const findings = k.auditFindings ?? null
    list.push({
      key: `q:${k.contractorUuid}:${k.workOrderUuid}:${k.month}`,
      kind: 'quarterly',
      date: k.month,
      title: `${quarterOf(k.month).label} · ${wo ? `WO ${wo.number}` : c.name}`,
      detail: findings ? `${k.auditClosed ?? 0} of ${findings} findings closed` : 'Quarterly audit',
      pct: k.quarterlyAuditPct,
      to: `/contractors/${c.uuid}?m=${k.month}`,
    })
  }
  for (const i of contractorInspections(d, c)) {
    const s = inspectionScore(i)
    list.push({
      key: `i:${i.id}`,
      kind: 'inspection',
      date: i.info.reviewDate,
      title: `${i.info.facilityLocation || 'Inspection'} · ${dayMonth(i.info.reviewDate)}`,
      detail: findingsText(s?.flagged ?? 0),
      pct: s?.pct ?? null,
      to: `/inspection/${i.id}`,
    })
  }
  list.sort((x, y) => (x.date === y.date ? byNumber(x.title, y.title) : x.date < y.date ? 1 : -1))
  const series = months.map((m) => {
    const vals = list.filter((x) => x.date.startsWith(m) && x.pct !== null).map((x) => x.pct as number)
    return vals.length ? round(vals.reduce((s, v) => s + v, 0) / vals.length) : null
  })
  return { series, list }
}

/** A camp's inspection scores over time (completed, scored), oldest first. */
export function campScoreSeries(camp: Camp, inspections: Inspection[]): { id: number; date: string; value: number }[] {
  return campInspections(camp, inspections)
    .filter((i) => i.id !== undefined && i.status === 'completed' && i.info?.reviewDate)
    .map((i) => ({ id: i.id as number, date: i.info.reviewDate, value: inspectionScore(i)?.pct ?? null }))
    .filter((p): p is { id: number; date: string; value: number } => p.value !== null)
    .reverse()
}
