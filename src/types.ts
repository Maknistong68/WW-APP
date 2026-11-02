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
  /** Camp this inspection was done at (co-pilot camps). */
  campUuid?: string
  /** From the camp log: score and rating only, no checklist (responses stay empty). */
  logged?: LoggedScore
}

/** A camp-log inspection's result, e.g. { pct: 86, rating: 'Good' }. */
export interface LoggedScore {
  /** 0–100 */
  pct: number
  /** Excellent · Good · Partially Compliant · Minimally Compliant */
  rating: string
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
export type RecordTable = 'contractors' | 'workOrders' | 'camps' | 'tickets' | 'kpiMonths' | 'manpower' | 'weeklyCounts' | 'sitePlaces' | 'mapItems' | 'routines'

interface RecordBase {
  uuid: string
  updatedAt: string
}

export interface Contractor extends RecordBase {
  name: string
  /**
   * Off = not followed (no KPIs, not on Home, listed as Inactive). A contractor that is on but has
   * every work order off is not followed either (see isFollowed in src/lib/subjects.ts).
   */
  active: boolean
  /** Every other spelling of this contractor met in files or audits. */
  aliases: string[]
  notes: string
}

/** A contract under a contractor; KPIs, manpower and tickets can be per work order. */
export interface WorkOrder extends RecordBase {
  contractorUuid: string
  /** Work order number, e.g. "882". */
  number: string
  /** Optional short description (camp, scope). */
  label: string
  active: boolean
  notes: string
}

/** Where a site sits on the 3D "Live site" map (one shared row per site; uuid fixed per site). */
export interface SitePlace extends RecordBase {
  siteId: string
  /** Min corner of the footprint, in tiles. */
  gx: number
  gz: number
  /** Quarter turns, 0–3. */
  rot: number
  /** Layout format (3 = the city-scale octagon, 2 = the bigger octagon); missing = the first version. */
  v?: number
}

/** Something on the "Live site" map the Admin can change: a road, highway, palms, camp, village or zone. */
export interface MapItemRecord extends RecordBase {
  kind: string
  /** Roads / highways: the line; palms: one point per tree; zones: the outline. */
  points?: [number, number][]
  x?: number
  z?: number
  rot?: number
  /** Hidden (lets default items be deleted too). */
  removed?: boolean
  /** Map format (3 = the city-scale octagon); missing = drawn on the small octagon. */
  v?: number
}

/** A worker accommodation camp, inspected every `cycleDays`. */
/** How often a routine task comes back. */
export type RoutineRepeat = 'once' | 'daily' | 'weekly' | 'monthly'

/**
 * A to-do the team adds with the + button (shared, like tickets). Repeating
 * ones come back: weekly on the start date's weekday, monthly on its day
 * (the last day in shorter months). See src/lib/routines.ts.
 */
export interface Routine extends RecordBase {
  title: string
  repeat: RoutineRepeat
  /** YYYY-MM-DD: the due date (once) or the first one (repeats). */
  start: string
  /** YYYY-MM-DD of the latest date ticked off or skipped; '' = none yet. */
  doneThrough: string
  notes: string
}

export interface Camp extends RecordBase {
  name: string
  contractorUuid: string
  /** '' = not tied to one work order */
  workOrderUuid: string
  location: string
  /** Inspection cycle; expired after this many days without an inspection. */
  cycleDays: number
  active: boolean
  notes: string
}

export type TicketSource = 'System' | 'Internal'
export type TicketStatus = 'Open' | 'In progress' | 'Closed'

export interface Ticket extends RecordBase {
  source: TicketSource
  /** ticket number, e.g. WWCMPL0009640. */
  ticketNo: string
  channel: string
  contractorUuid: string
  /** Optional work order under the contractor ('' = contractor level). */
  workOrderUuid: string
  subcontractor: string
  category: string
  issue: string
  /** 1 Critical · 2 High · 3 Moderate · 4 Low */
  priority: number
  severity: string
  workers: number
  violations: number
  /** Money owed to workers, SAR (null = not known). On a combined group only the main ticket holds it. */
  amountOwed: number | null
  /** Main ticket this one was combined into ('' = standalone or main). */
  parentUuid: string
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

export type DeclField = 'wps' | 'manpowerDecl' | 'salaryDecl'

/** The documents a contractor hands in each month (src/lib/submissions.ts). */
export type SubmissionKey =
  | 'welfareReport'
  | 'issueLog'
  | 'manpowerDecl'
  | 'subconDecl'
  | 'committeeMinutes'
  | 'workforceDecl'
  | 'pestControl'
  | 'activitySchedule'
  | 'waterTest'
  | 'wps'
  | 'salaryDecl'

/**
 * One document for one month: in (with the date it came), not provided, not
 * applicable, or waiting (kept only with a note, or to end last month's "not
 * applicable").
 */
export interface DocEntry {
  state: 'in' | 'notProvided' | 'na' | 'awaited'
  /** YYYY-MM-DD it came in. */
  on?: string
  note?: string
  /** Item 2: which one was sent. */
  variant?: 'issueLog' | 'iap'
}

export interface KpiMonth extends RecordBase {
  contractorUuid: string
  /** '' = scored at contractor level (contractor without work orders). */
  workOrderUuid: string
  /** YYYY-MM */
  month: string
  /** Declarations received. */
  wps: boolean
  manpowerDecl: boolean
  salaryDecl: boolean
  /** Declarations the contractor said they can't provide (or that don't apply): not chased, left out of the score. */
  notProvided?: DeclField[]
  /** The monthly documents (src/lib/submissions.ts). WPS / Manpower / Salary keep their state in the fields above; here they only add the date and note. */
  docs?: Partial<Record<SubmissionKey, DocEntry>>
  /** 0–100, null = not scored */
  accommodationPct: number | null
  onboardingPct: number | null
  /** 0–100, typed in. Months saved before this field use the counts below. */
  offboardingPct?: number | null
  /** Older months only: offboarded on time / total offboarded. */
  offboarded?: number | null
  offboardTotal?: number | null
  /** Meeting attended: yes = 100, no = 0, null = not answered. */
  meetingPct: number | null
  /** Optional each month: only filled in the month of the quarterly audit. */
  quarterlyAuditPct: number | null
  /** Percentages typed straight into the old Excel KPI tracker (import only). */
  legacy?: { offboardingPct?: number | null; formalPct?: number | null }
  /** Quarterly audit close-out (counts only). YYYY-MM-DD. */
  auditDate?: string
  /** Findings raised in the quarterly audit. */
  auditFindings?: number | null
  /** Findings the contractor has closed out. */
  auditClosed?: number | null
  /** YYYY-MM-DD; defaults to the audit date + 30 days. */
  auditDueDate?: string
}

export interface Manpower extends RecordBase {
  contractorUuid: string
  /** '' = contractor level. */
  workOrderUuid: string
  /** YYYY-MM */
  month: string
  totalWorkers: number
  illegalOrFreelance: number
  visaExpiring30d: number
  paidRecruitmentFees: number
}

/** Open system tickets counted in one weekly snapshot (imported history). */
export interface WeeklyCount extends RecordBase {
  /** YYYY-MM-DD */
  weekEnding: string
  openTickets: number
}

export type ActivityEntity = 'ticket' | 'contractor' | 'workOrder' | 'camp' | 'user' | 'kpi' | 'manpower' | 'weekly' | 'audit' | 'import' | 'site' | 'map' | 'routine'
export type ActivityAction = 'add' | 'edit' | 'close' | 'reopen' | 'delete' | 'restore' | 'import'

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
  /** Who made the change (user id). The server stamps it again from the account that sent it. */
  by?: string
  /** Their name when the entry was made, for people no longer in the team list. */
  byName?: string
  /** Set once the entry reached Supabase. */
  synced?: boolean
}
