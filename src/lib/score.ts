import type {
  ComplianceAssessment,
  Inspection,
  InspectionTemplate,
  QuestionResponse,
} from '../types'

// ---------------------------------------------------------------------------
// Single source of truth for what counts as answered / non-compliant / a
// report finding, and for the scoring scales. The Excel and Word exports,
// the checklist filters, and the KPI math must all agree — change here only.
// ---------------------------------------------------------------------------

/** A question counts as answered once either control has a value. */
export const isAnswered = (r?: QuestionResponse): boolean =>
  !!r && (r.assessment !== '' || r.yesNo !== '')

/** Non-compliant: the assessment itself flags a problem. */
export const isFlagged = (r?: QuestionResponse): boolean =>
  r?.assessment === 'No compliance' || r?.assessment === 'Partial compliance'

/**
 * Belongs in the report findings tables: any non-compliance, plus anything
 * the inspector wrote up even under full compliance.
 */
export const isFinding = (r?: QuestionResponse): boolean =>
  isFlagged(r) || !!r?.observation || !!r?.actionPlan

/** Workbook points scale: Full = 2, Partial = 1, None = 0, otherwise null. */
export const assessmentScore = (a: ComplianceAssessment | undefined): number | null =>
  a === 'Full compliance' ? 2 : a === 'Partial compliance' ? 1 : a === 'No compliance' ? 0 : null

/** Same scale expressed out of 100 (Full = 100, Partial = 50, None = 0). */
export const assessmentPct = (a: ComplianceAssessment | undefined): number | null => {
  const s = assessmentScore(a)
  return s === null ? null : s * 50
}

export interface InspectionScore {
  /** 0–100, or null when nothing scoreable is answered yet. */
  pct: number | null
  answered: number
  total: number
  flagged: number
}

/**
 * Mirrors the workbook's scoring: Full = 100, Partial = 50, No compliance = 0,
 * N/A excluded; the score is the average over scored questions.
 */
export function scoreInspection(template: InspectionTemplate, inspection: Inspection): InspectionScore {
  let scored = 0
  let sum = 0
  let answered = 0
  let flagged = 0
  let total = 0
  for (const section of template.sections) {
    for (const q of section.questions) {
      total++
      const resp = inspection.responses[q.code]
      if (!resp) continue
      if (isAnswered(resp)) answered++
      if (isFlagged(resp)) flagged++
      const pct = assessmentPct(resp.assessment)
      if (pct !== null) {
        scored++
        sum += pct
      }
    }
  }
  return { pct: scored > 0 ? Math.round(sum / scored) : null, answered, total, flagged }
}
