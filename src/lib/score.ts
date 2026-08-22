import type { Inspection, InspectionTemplate } from '../types'

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
      if (resp.assessment !== '' || resp.yesNo !== '') answered++
      switch (resp.assessment) {
        case 'Full compliance':
          scored++
          sum += 100
          break
        case 'Partial compliance':
          scored++
          sum += 50
          flagged++
          break
        case 'No compliance':
          scored++
          flagged++
          break
        default:
          break
      }
    }
  }
  return { pct: scored > 0 ? Math.round(sum / scored) : null, answered, total, flagged }
}
