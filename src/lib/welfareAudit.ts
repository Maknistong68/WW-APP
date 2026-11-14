import { defaultDue, setAuditDate } from './closeout'
import { monthOf } from './dates'
import type { AllData } from './kpiData'
import { scoreInspection } from './score'
import { kpiSubjects, subjectKpi, woOf } from './subjects'
import { quarterMonths } from './todo'
import { getTemplate } from '../templates'
import type { Inspection, KpiMonth } from '../types'

export { WELFARE_AUDIT, isWelfareAudit, splitInspections } from './inspectionKinds'

// ---- Completing an audit fills its work order's quarterly audit KPI ------------------------

export interface AuditKpiPlan {
  /** The audit date's month: the KPI month the score goes in. */
  month: string
  contractorUuid: string
  workOrderUuid: string
  /** Final score, 0–100. */
  pct: number
  /** The "No" answers: the close-out's findings. */
  findings: number
  date: string
  /** The close-out's due date: the audit date + 30 days. */
  dueDate: string
  /** A score already in for this quarter, from another source, that this replaces. */
  replaces: { month: string; pct: number } | null
}

/** What completing this audit writes into the quarterly audit KPI (null when there's nothing to write). */
export function auditKpiPlan(audit: Inspection, d: AllData): AuditKpiPlan | null {
  const { workOrderUuid, contractorUuid, reviewDate: date } = audit.info ?? ({} as Inspection['info'])
  const template = getTemplate(audit.templateId)
  if (!template || !date || !contractorUuid) return null
  const s = kpiSubjects(d.contractors, d.workOrders).find((x) => x.contractor.uuid === contractorUuid && woOf(x) === (workOrderUuid ?? ''))
  const pct = scoreInspection(template, audit).pct
  if (!s || pct === null) return null
  const month = monthOf(date)
  const findings = Object.values(audit.responses).filter((r) => r.assessment === 'No compliance').length
  const other = (k: KpiMonth | undefined) => k?.quarterlyAuditPct != null && k.auditInspectionUuid !== audit.uuid
  let replaces: AuditKpiPlan['replaces'] = null
  for (const m of [month, ...quarterMonths(month).filter((x) => x !== month)]) {
    const k = subjectKpi(s, d.kpis, m)
    if (other(k)) {
      replaces = { month: m, pct: k!.quarterlyAuditPct! }
      break
    }
  }
  return { month, contractorUuid, workOrderUuid: woOf(s), pct, findings, date, dueDate: defaultDue(date), replaces }
}

/** The KPI month with this audit's score, date, findings and due date (findings closed kept when it's the same audit). */
export function withAudit(k: KpiMonth, plan: AuditKpiPlan, auditUuid: string): KpiMonth {
  const same = k.auditInspectionUuid === auditUuid
  return setAuditDate(
    { ...k, quarterlyAuditPct: plan.pct, auditFindings: plan.findings, auditClosed: same ? (k.auditClosed ?? 0) : 0, auditInspectionUuid: auditUuid },
    plan.date,
  )
}
