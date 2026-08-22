export type YesNoNA = '' | 'Yes' | 'No' | 'N/A'

export type ComplianceAssessment =
  | ''
  | 'Full compliance'
  | 'Partial compliance'
  | 'No compliance'
  | 'N/A'

export interface Question {
  /** Question code as it appears in the workbook, e.g. "A1". */
  code: string
  text: string
}

export interface Section {
  /** Section letter A–X. */
  letter: string
  title: string
  questions: Question[]
}

export interface InspectionTemplate {
  id: string
  name: string
  shortName: string
  description: string
  /** Header shown above the questionnaire table (e.g. "Group Labor Accommodation"). */
  questionnaireTitle: string
  /** Excel cover sheet title (e.g. "Labour Accommodation Audit Report"). */
  coverTitle: string
  /** Suffix after the contractor name atop the questionnaire sheet (e.g. "Camp Welfare Inspection"). */
  reportHeading: string
  /** Title of the Word findings report. */
  wordTitle: string
  sections: Section[]
}

export interface QuestionResponse {
  yesNo: YesNoNA
  assessment: ComplianceAssessment
  observation: string
  /** Action plan / remarks — used in the Summary sheet and the Word report. */
  actionPlan: string
}

export interface GeneralInfo {
  typeOfReview: string
  reviewDate: string
  auditTeam: string
  region: string
  facilityLocation: string
  facilityType: string
  mapCoordinates: string
  googleMapsLink: string
  facilityManagement: string
  occupantsNumber: string
  numberOfRooms: string
  maxOccupancy: string
  contractorsCount: string
  contractorNames: string
  projectsServed: string
  facilityRepresentative: string
  /** e.g. "4800000882/1272" — used in the Word report. */
  workOrder: string
}

export interface Inspection {
  id?: number
  /** Stable identity across devices/backups; used for cloud sync. */
  uuid?: string
  templateId: string
  status: 'draft' | 'completed'
  createdAt: string
  updatedAt: string
  info: GeneralInfo
  /** Keyed by question code (e.g. "A1"). */
  responses: Record<string, QuestionResponse>
  /** Extra remarks appended to the Word report conclusion. */
  notes: string
}

export interface Photo {
  id?: number
  /** Stable identity across devices/backups; used for cloud sync. */
  uuid?: string
  inspectionId: number
  /**
   * What the photo is attached to:
   *  - a question code ("A1") for checklist evidence
   *  - FACILITY_PHOTOS for general site photos (General Information sheet)
   *  - null while still unassigned
   */
  itemId: string | null
  blob: Blob
  caption: string
  createdAt: string
  /** Bumped on caption/assignment changes so sync can pick a winner. */
  updatedAt?: string
  /** Set once the blob has been uploaded to cloud storage. */
  syncedAt?: string
}

export interface LogEntry {
  id?: number
  /** null = app-level event (backup, sync, …). */
  inspectionId: number | null
  time: string
  event: string
  detail: string
}

export interface Tombstone {
  id?: number
  table: 'inspections' | 'photos'
  uuid: string
}

/** Special Photo.itemId for general facility/site photos. */
export const FACILITY_PHOTOS = '@facility'

export const YES_NO_OPTIONS: YesNoNA[] = ['Yes', 'No', 'N/A']

export const ASSESSMENT_OPTIONS: ComplianceAssessment[] = [
  'Full compliance',
  'Partial compliance',
  'No compliance',
  'N/A',
]

export const EMPTY_RESPONSE: QuestionResponse = {
  yesNo: '',
  assessment: '',
  observation: '',
  actionPlan: '',
}

export const complianceScore = (a: ComplianceAssessment): number | null => {
  switch (a) {
    case 'Full compliance':
      return 2
    case 'Partial compliance':
      return 1
    case 'No compliance':
      return 0
    default:
      return null
  }
}
