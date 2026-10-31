import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newUuid } from '../db'
import { localDate } from './dates'
import { TICKET_PREFIX } from './lists'
import type { Contractor, Ticket, WorkOrder } from '../types'

export function useContractors() {
  const list = useLiveQuery(() => db.contractors.orderBy('name').toArray())
  const wos = useLiveQuery(() => db.workOrders.toArray())
  return useMemo(() => {
    const all = list ?? []
    const workOrders = [...(wos ?? [])].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
    return {
      loaded: !!list && !!wos,
      all,
      byUuid: new Map(all.map((c) => [c.uuid, c])),
      workOrders,
      woByUuid: new Map(workOrders.map((w) => [w.uuid, w])),
    }
  }, [list, wos])
}

/** "WO 882" or "WO 882 · Camp 3" */
export const woName = (w: WorkOrder | undefined) => (w ? `WO ${w.number}${w.label ? ` · ${w.label}` : ''}` : '')

export { TICKET_PREFIX, validTicketNo } from './lists'

export const contractorName = (map: Map<string, Contractor>, uuid: string) =>
  map.get(uuid)?.name ?? 'No contractor'

export function newTicket(): Ticket {
  return {
    uuid: newUuid(),
    updatedAt: '',
    source: 'System',
    ticketNo: TICKET_PREFIX,
    channel: 'Worker Hotline',
    contractorUuid: '',
    workOrderUuid: '',
    subcontractor: '',
    category: 'Employment Practice',
    issue: '',
    priority: 2,
    severity: 'Not Acceptable',
    workers: 1,
    violations: 1,
    amountOwed: null,
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
  return { uuid: newUuid(), updatedAt: '', name, active: true, aliases: [], notes: '' }
}

export function newWorkOrder(contractorUuid: string, number = ''): WorkOrder {
  return { uuid: newUuid(), updatedAt: '', contractorUuid, number, label: '', active: true, notes: '' }
}

/** Activity-log label: the ticket number first. */
export const ticketLabel = (t: Ticket, map: Map<string, Contractor>) =>
  `${t.ticketNo || 'Ticket'} · ${contractorName(map, t.contractorUuid)}`

/** Display names for record fields in the activity log. */
export const FIELD_LABELS: Record<string, string> = {
  source: 'Source',
  ticketNo: 'Ticket no.',
  channel: 'Channel',
  contractorUuid: 'Contractor',
  workOrderUuid: 'Work order',
  amountOwed: 'Money owed (SAR)',
  number: 'Work order no.',
  label: 'Description',
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
