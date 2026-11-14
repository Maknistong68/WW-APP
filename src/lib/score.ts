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

export interface SectionScore {
  letter: string
  title: string
  /** Full = the question's weight, Partial = half of it, No = 0. */
  points: number
  /** The weights of the questions answered Full / Partial / No (N/A left out). */
  possible: number
  /** points ÷ possible, 0–100; null until something in it is scored. */
  pct: number | null
  answered: number
  total: number
  flagged: number
}

export interface InspectionScore {
  /** 0–100, or null when nothing scoreable is answered yet. */
  pct: number | null
  answered: number
  total: number
  flagged: number
  /** Templates scored by sections (Worker Welfare audit): each section's score. */
  sections?: SectionScore[]
}

/** Scoring by sections: each section's points out of what it could get; the audit averages its sections. */
function scoreBySections(template: InspectionTemplate, inspection: Inspection): InspectionScore {
  const sections: SectionScore[] = template.sections.map((section) => {
    let points = 0
    let possible = 0
    let answered = 0
    let flagged = 0
    for (const q of section.questions) {
      const resp = inspection.responses[q.code]
      if (!resp) continue
      if (isAnswered(resp)) answered++
      if (isFlagged(resp)) flagged++
      const share = assessmentPct(resp.assessment)
      if (share === null) continue
      const weight = q.weight ?? 1
      possible += weight
      points += (weight * share) / 100
    }
    return { letter: section.letter, title: section.title, points, possible, pct: possible ? (points / possible) * 100 : null, answered, total: section.questions.length, flagged }
  })
  const scored = sections.filter((x) => x.pct !== null)
  const pct = scored.length ? Math.round((scored.reduce((a, x) => a + x.pct!, 0) / scored.length) * 10) / 10 : null
  const add = (k: 'answered' | 'total' | 'flagged') => sections.reduce((a, x) => a + x[k], 0)
  return { pct, answered: add('answered'), total: add('total'), flagged: add('flagged'), sections }
}

/** An audit score as the workbook shows it: one decimal when it has one ("96.8%", "100%"). */
export const scoreText = (pct: number | null | undefined) => (pct === null || pct === undefined ? '—' : `${Math.round(pct * 10) / 10}%`)

/** The grade for a final score (Worker Welfare audit): Excellent 90+, Good 80+, Partially 70+, Minimally 60+. */
export function gradeOf(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return ''
  return pct >= 90 ? 'Excellent' : pct >= 80 ? 'Good' : pct >= 70 ? 'Partially compliant' : pct >= 60 ? 'Minimally compliant' : 'Non-compliant'
}

/**
 * Mirrors the workbook's scoring: Full = 100, Partial = 50, No compliance = 0,
 * N/A excluded; the score is the average over scored questions.
 */
export function scoreInspection(template: InspectionTemplate, inspection: Inspection): InspectionScore {
  if (template.scoring === 'sections') return scoreBySections(template, inspection)
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
