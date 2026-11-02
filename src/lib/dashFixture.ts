import type { AllData } from './kpiData'
import type { Camp, Contractor, GeneralInfo, Inspection, KpiMonth, Manpower, Ticket, WorkOrder } from '../types'

// A small, hand-checked data set for the Dashboard tests (src/lib/focus,
// explore, overTime, peek). Two contractors: Al Fahad (work order 882) and RPCO;
// five D&C tickets and one case.

export const TODAY = '2026-11-02'
export const MONTH = '2026-10'

const ticket = (p: Partial<Ticket> & { uuid: string }): Ticket => ({
  updatedAt: '',
  source: 'System',
  ticketNo: `WW${p.uuid}`,
  channel: '',
  contractorUuid: 'ca',
  workOrderUuid: 'w1',
  subcontractor: '',
  category: 'Pay',
  issue: 'Salary delay',
  priority: 2,
  severity: '',
  workers: 1,
  violations: 1,
  amountOwed: null,
  parentUuid: '',
  assignedTo: '',
  status: 'Open',
  openedAt: '2026-10-01',
  closedAt: '',
  contractorAction: '',
  wwAction: '',
  notes: '',
  ...p,
})

const kpi = (p: Partial<KpiMonth> & { uuid: string; contractorUuid: string; workOrderUuid: string; month: string }): KpiMonth => ({
  updatedAt: '',
  wps: true,
  manpowerDecl: true,
  salaryDecl: true,
  accommodationPct: null,
  onboardingPct: null,
  meetingPct: null,
  quarterlyAuditPct: null,
  ...p,
})

const info = (reviewDate: string): GeneralInfo => ({
  typeOfReview: '',
  reviewDate,
  auditTeam: '',
  region: '',
  facilityLocation: '',
  facilityType: '',
  mapCoordinates: '',
  googleMapsLink: '',
  facilityManagement: '',
  occupantsNumber: '',
  numberOfRooms: '',
  maxOccupancy: '',
  contractorsCount: '',
  contractorNames: '',
  projectsServed: '',
  facilityRepresentative: '',
  workOrder: '',
})

export function fixture(): AllData {
  const contractors: Contractor[] = [
    { uuid: 'ca', updatedAt: '', name: 'Al Fahad', active: true, aliases: [], notes: '' },
    { uuid: 'cb', updatedAt: '', name: 'RPCO', active: true, aliases: [], notes: '' },
  ]
  const workOrders: WorkOrder[] = [{ uuid: 'w1', updatedAt: '', contractorUuid: 'ca', number: '882', label: '', active: true, notes: '' }]
  const tickets: Ticket[] = [
    ticket({ uuid: 't1', openedAt: '2026-10-05', workers: 10, amountOwed: 5000 }),
    ticket({ uuid: 't2', openedAt: '2026-09-20', workers: 5, issue: 'Food', category: 'Welfare' }),
    ticket({ uuid: 't3', contractorUuid: 'cb', workOrderUuid: '', openedAt: '2026-10-10', status: 'Closed', closedAt: '2026-10-20', workers: 3, amountOwed: 2000, issue: 'Food', category: 'Welfare' }),
    ticket({ uuid: 't4', contractorUuid: 'cb', workOrderUuid: '', openedAt: '2026-10-28', workers: 2 }),
    ticket({ uuid: 't5', openedAt: '2026-08-01', status: 'Closed', closedAt: '2026-10-02', workers: 4, amountOwed: 1000 }),
  ]
  // The team's own case (kept apart from the D&C tickets above).
  const cases: Ticket[] = [ticket({ uuid: 'x1', ticketNo: 'CASE-0001', source: 'Internal', contractorUuid: 'cb', workOrderUuid: '', openedAt: '2026-10-15', workers: 1, issue: 'Overtime' })]
  const kpis: KpiMonth[] = [
    kpi({ uuid: 'k1', contractorUuid: 'ca', workOrderUuid: 'w1', month: '2026-10', salaryDecl: false, accommodationPct: 90, onboardingPct: 80, meetingPct: 100, quarterlyAuditPct: 85, auditDate: '2026-10-10', auditFindings: 4, auditClosed: 2 }),
    kpi({ uuid: 'k2', contractorUuid: 'cb', workOrderUuid: '', month: '2026-10', accommodationPct: 95, onboardingPct: 90, meetingPct: 100 }),
    kpi({ uuid: 'k3', contractorUuid: 'ca', workOrderUuid: 'w1', month: '2026-09', accommodationPct: 70, onboardingPct: 70, meetingPct: 0 }),
  ]
  const manpower: Manpower[] = [
    { uuid: 'm1', updatedAt: '', contractorUuid: 'ca', workOrderUuid: 'w1', month: '2026-10', totalWorkers: 100, illegalOrFreelance: 2, visaExpiring30d: 5, paidRecruitmentFees: 0 },
    { uuid: 'm2', updatedAt: '', contractorUuid: 'cb', workOrderUuid: '', month: '2026-10', totalWorkers: 50, illegalOrFreelance: 0, visaExpiring30d: 1, paidRecruitmentFees: 1 },
    { uuid: 'm3', updatedAt: '', contractorUuid: 'ca', workOrderUuid: 'w1', month: '2026-09', totalWorkers: 90, illegalOrFreelance: 0, visaExpiring30d: 0, paidRecruitmentFees: 0 },
  ]
  const camps: Camp[] = [
    { uuid: 'c1', updatedAt: '', name: 'Camp 1', contractorUuid: 'ca', workOrderUuid: 'w1', location: '', cycleDays: 90, active: true, notes: '' },
    { uuid: 'c2', updatedAt: '', name: 'Camp 2', contractorUuid: 'cb', workOrderUuid: '', location: '', cycleDays: 90, active: true, notes: '' },
    { uuid: 'c3', updatedAt: '', name: 'Old camp', contractorUuid: 'ca', workOrderUuid: '', location: '', cycleDays: 90, active: false, notes: '' },
  ]
  const inspections: Inspection[] = [
    { id: 1, templateId: 'x', status: 'completed', createdAt: '', updatedAt: '', info: info('2026-10-12'), responses: {}, notes: '', campUuid: 'c1', logged: { pct: 86, rating: 'Good' } },
    { id: 2, templateId: 'x', status: 'completed', createdAt: '', updatedAt: '', info: info('2026-07-01'), responses: {}, notes: '', campUuid: 'c2', logged: { pct: 70, rating: 'Partially Compliant' } },
  ]
  return {
    loaded: true,
    contractors,
    byUuid: new Map(contractors.map((c) => [c.uuid, c])),
    workOrders,
    woByUuid: new Map(workOrders.map((w) => [w.uuid, w])),
    camps,
    tickets,
    cases,
    kpis,
    manpower,
    weekly: [],
    inspections,
  }
}
