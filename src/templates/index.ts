import type { InspectionTemplate } from '../types'
import { accommodation } from './accommodation'
import { welfareAudit } from './welfareAudit'

export const TEMPLATES: InspectionTemplate[] = [accommodation, welfareAudit]

export const getTemplate = (id: string): InspectionTemplate | undefined =>
  TEMPLATES.find((t) => t.id === id)

export const countItems = (t: InspectionTemplate): number =>
  t.sections.reduce((n, s) => n + s.questions.length, 0)
