export type ResultValue = 'compliant' | 'non_compliant' | 'na' | 'not_checked'

export interface ChecklistItemTemplate {
  id: string
  text: string
  guidance?: string
}

export interface ChecklistSectionTemplate {
  id: string
  title: string
  items: ChecklistItemTemplate[]
}

export interface InspectionTemplate {
  id: string
  name: string
  shortName: string
  description: string
  /** Which export outputs this checklist produces. */
  exports: Array<'excel' | 'word'>
  sections: ChecklistSectionTemplate[]
}

export interface ItemResponse {
  result: ResultValue
  observation: string
  correctiveAction: string
}

export interface InspectionMeta {
  reference: string
  date: string
  contractor: string
  location: string
  inspector: string
  notes: string
}

export interface Inspection {
  id?: number
  templateId: string
  status: 'draft' | 'completed'
  createdAt: string
  updatedAt: string
  meta: InspectionMeta
  /** Keyed by checklist item id. */
  responses: Record<string, ItemResponse>
}

export interface Photo {
  id?: number
  inspectionId: number
  /** Checklist item the photo is attached to; null while still unassigned. */
  itemId: string | null
  blob: Blob
  caption: string
  createdAt: string
}

export const RESULT_LABELS: Record<ResultValue, string> = {
  compliant: 'Compliant',
  non_compliant: 'Non-compliant',
  na: 'N/A',
  not_checked: 'Not checked',
}
