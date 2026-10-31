import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newUuid } from '../db'
import { localDate } from './dates'
import type { Contractor, Ticket } from '../types'

export function useContractors() {
  const list = useLiveQuery(() => db.contractors.orderBy('name').toArray())
  return useMemo(() => {
    const all = list ?? []
    return { loaded: !!list, all, byUuid: new Map(all.map((c) => [c.uuid, c])) }
  }, [list])
}

export const contractorName = (map: Map<string, Contractor>, uuid: string) =>
  map.get(uuid)?.name ?? 'No contractor'

export function newTicket(): Ticket {
  return {
    uuid: newUuid(),
    updatedAt: '',
    source: 'Internal',
    ticketNo: '',
    channel: 'Welfare Internal',
    contractorUuid: '',
    subcontractor: '',
    category: 'Employment Practice',
    issue: '',
    priority: 2,
    severity: 'Not Acceptable',
    workers: 1,
    violations: 1,
    assignedTo: '',
    status: 'Open',
    openedAt: localDate(),
    closedAt: '',
    contractorAction: '',
    wwAction: '',
    notes: '',
  }
}

export function newContractor(name = ''): Contractor {
  return { uuid: newUuid(), updatedAt: '', name, workOrder: '', active: true, aliases: [], notes: '' }
}

export const ticketLabel = (t: Ticket, map: Map<string, Contractor>) =>
  `${contractorName(map, t.contractorUuid)} · ${t.issue || 'Ticket'}`

/** Display names for record fields in the activity log. */
export const FIELD_LABELS: Record<string, string> = {
  source: 'Source',
  ticketNo: 'no.',
  channel: 'Channel',
  contractorUuid: 'Contractor',
  subcontractor: 'Sub-contractor',
  category: 'Category',
  issue: 'Issue',
  priority: 'Priority',
  severity: 'Severity',
  workers: 'Workers',
  violations: 'Violations',
  assignedTo: 'Assigned to',
  status: 'Status',
  openedAt: 'Opened',
  closedAt: 'Closed',
  contractorAction: 'Contractor action',
  wwAction: 'WW action',
  notes: 'Notes',
  name: 'Name',
  workOrder: 'Work order',
  active: 'Active',
  aliases: 'Other names',
  wps: 'WPS',
  manpowerDecl: 'Manpower declaration',
  salaryDecl: 'Salary declaration',
  accommodationPct: 'Accommodation %',
  onboardingPct: 'Onboarding %',
  offboarded: 'Offboarded',
  offboardTotal: 'Offboarding total',
  meetingPct: 'Meeting attendance %',
  quarterlyAuditPct: 'Quarterly audit %',
  totalWorkers: 'Total workers',
  illegalOrFreelance: 'Illegal / freelance',
  visaExpiring30d: 'Visas expiring',
  paidRecruitmentFees: 'Paid recruitment fees',
  month: 'Month',
}
