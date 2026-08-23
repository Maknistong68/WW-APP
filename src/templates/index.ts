import type { InspectionTemplate, WalkthroughArea } from '../types'
import { accommodation } from './accommodation'
import { welfareAudit } from './welfareAudit'
import { accommodationWalkthrough } from './walkthrough'

export const TEMPLATES: InspectionTemplate[] = [accommodation, welfareAudit]

export const getTemplate = (id: string): InspectionTemplate | undefined =>
  TEMPLATES.find((t) => t.id === id)

export const countItems = (t: InspectionTemplate): number =>
  t.sections.reduce((n, s) => n + s.questions.length, 0)

/** Area-by-area walkthrough view, where one exists for the template. */
export const getWalkthrough = (templateId: string): WalkthroughArea[] | null =>
  templateId === 'accommodation' ? accommodationWalkthrough : null
