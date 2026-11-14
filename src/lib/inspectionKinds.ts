import type { Inspection } from '../types'

// Camp inspections and Worker Welfare audits (src/templates/welfareAudit.ts),
// apart: an audit is done for a work order and never counts toward camps, their
// cycle, the accommodation KPI or the Accommodation dashboard.

export const WELFARE_AUDIT = 'welfare_audit'

export const isWelfareAudit = (i: Pick<Inspection, 'templateId'>) => i.templateId === WELFARE_AUDIT

export function splitInspections(all: Inspection[]): { inspections: Inspection[]; audits: Inspection[] } {
  const inspections: Inspection[] = []
  const audits: Inspection[] = []
  for (const i of all) (isWelfareAudit(i) ? audits : inspections).push(i)
  return { inspections, audits }
}
