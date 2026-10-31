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
  /**
   * Inspector-chosen note for the Word report's Photos column when a finding
   * has no photo (e.g. "NO TRAINING RECORDS PROVIDED"). Optional — older
   * records don't have it, and the export falls back to a keyword guess.
   */
  evidenceNote?: string
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

export interface WalkthroughLine {
  /** Official question codes this reminder answers (first code holds notes/photos). */
  codes: string[]
  /** Short field reminder, e.g. "Privacy screen/curtain for EVERY bed space". */
  label: string
}

export interface WalkthroughArea {
  title: string
  lines: WalkthroughLine[]
}

/** Quick statuses used in walkthrough mode, mapped onto the questionnaire. */
export type WalkStatus = 'ok' | 'partial' | 'obs' | 'na'

export const WALK_STATUS_PATCH: Record<WalkStatus, Pick<QuestionResponse, 'yesNo' | 'assessment'>> = {
  ok: { yesNo: 'Yes', assessment: 'Full compliance' },
  partial: { yesNo: 'Yes', assessment: 'Partial compliance' },
  obs: { yesNo: 'No', assessment: 'No compliance' },
  na: { yesNo: 'N/A', assessment: 'N/A' },
}

export const assessmentToWalkStatus = (a: ComplianceAssessment): WalkStatus | null => {
  switch (a) {
    case 'Full compliance':
      return 'ok'
    case 'Partial compliance':
      return 'partial'
    case 'No compliance':
      return 'obs'
    case 'N/A':
      return 'na'
    default:
      return null
  }
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
  table: 'inspections' | 'photos' | RecordTable
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
  evidenceNote: '',
}

/** Quick-pick "no photo" evidence notes for the Word report's Photos column. */
export const EVIDENCE_NOTES: string[] = [
  'NO PHOTO EVIDENCE',
  'NO RECORDS / LOGS PROVIDED',
  'NO TRAINING RECORDS PROVIDED',
  'NO CERTIFICATE / LICENSE PROVIDED',
  'NO CONTRACT / AGREEMENT PROVIDED',
  'NO DOCUMENTATION PROVIDED',
  'BASED ON WORKER INTERVIEWS',
]

// ---------------------------------------------------------------------------
// Co-pilot records (tickets, contractors, KPIs, manpower). All are keyed by
// uuid locally and in Supabase, and every change goes through
// lib/records.ts so the activity log writes itself.
// ---------------------------------------------------------------------------

/** Dexie table names of the uuid-keyed record tables (also the sync tables). */
export type RecordTable = 'contractors' | 'tickets' | 'kpiMonths' | 'manpower' | 'weeklyCounts'

interface RecordBase {
  uuid: string
  updatedAt: string
}

export interface Contractor extends RecordBase {
  name: string
  workOrder: string
  active: boolean
  /** Every other spelling of this contractor met in files or audits. */
  aliases: string[]
  notes: string
}

export type TicketSource = '' | 'Internal'
export type TicketStatus = 'Open' | 'In progress' | 'Closed'

export interface Ticket extends RecordBase {
  source: TicketSource
  /** ticket number, e.g. WWCMPL0009640. */
  ticketNo: string
  channel: string
  contractorUuid: string
  subcontractor: string
  category: string
  issue: string
  /** 1 Critical · 2 High · 3 Moderate · 4 Low */
  priority: number
  severity: string
  workers: number
  violations: number
  assignedTo: string
  status: TicketStatus
  /** YYYY-MM-DD */
  openedAt: string
  /** YYYY-MM-DD, set when closed */
  closedAt: string
  contractorAction: string
  wwAction: string
  notes: string
}

export interface KpiMonth extends RecordBase {
  contractorUuid: string
  /** YYYY-MM */
  month: string
  wps: boolean
  manpowerDecl: boolean
  salaryDecl: boolean
  /** 0–100, null = not scored */
  accommodationPct: number | null
  onboardingPct: number | null
  offboarded: number | null
  offboardTotal: number | null
  /** 0–100 */
  meetingPct: number | null
  quarterlyAuditPct: number | null
  /** Percentages typed straight into the old Excel KPI tracker (import only). */
  legacy?: { offboardingPct?: number | null; formalPct?: number | null }
}

export interface Manpower extends RecordBase {
  contractorUuid: string
  /** YYYY-MM */
  month: string
  totalWorkers: number
  illegalOrFreelance: number
  visaExpiring30d: number
  paidRecruitmentFees: number
}

/** Open tickets counted in one weekly snapshot (imported history). */
export interface WeeklyCount extends RecordBase {
  /** YYYY-MM-DD */
  weekEnding: string
  openTickets: number
}

export type ActivityEntity = 'ticket' | 'contractor' | 'kpi' | 'manpower' | 'weekly' | 'audit' | 'import'
export type ActivityAction = 'add' | 'edit' | 'close' | 'reopen' | 'delete' | 'import'

export interface ActivityChange {
  field: string
  from: unknown
  to: unknown
}

/** Append-only activity log entry. */
export interface ActivityEntry {
  uuid: string
  time: string
  entity: ActivityEntity
  entityUuid: string
  action: ActivityAction
  /** Short human label, e.g. "RPCO · Salary not received". */
  label: string
  changes: ActivityChange[]
  /** Set once the entry reached Supabase. */
  synced?: boolean
}
