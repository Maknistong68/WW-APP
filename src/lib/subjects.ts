import { newUuid } from '../db'
import { allSettled, carryBefore } from './submissions'
import type { Contractor, KpiMonth, Manpower, Ticket, WorkOrder } from '../types'

/**
 * What KPIs are scored for: each active work order of an active contractor,
 * or the contractor itself when it has no work orders at all.
 */
export interface KpiSubject {
  /** Work order uuid, or contractor uuid for a contractor-level subject. */
  key: string
  contractor: Contractor
  workOrder?: WorkOrder
  /** "Al Fahad · WO 882" or "RPCO" */
  label: string
}

export const woOf = (s: KpiSubject) => s.workOrder?.uuid ?? ''

/**
 * Followed = scored, on Home and listed as Active: a switched-on contractor
 * with at least one active work order, or with no work orders at all. A
 * contractor whose work orders are all switched off counts as inactive.
 */
export function isFollowed(c: Contractor, workOrders: WorkOrder[]): boolean {
  if (!c.active) return false
  const wos = workOrders.filter((w) => w.contractorUuid === c.uuid)
  return wos.length === 0 || wos.some((w) => w.active)
}

export function kpiSubjects(contractors: Contractor[], workOrders: WorkOrder[]): KpiSubject[] {
  const out: KpiSubject[] = []
  for (const c of contractors) {
    if (!c.active) continue
    const wos = workOrders.filter((w) => w.contractorUuid === c.uuid)
    if (wos.length === 0) {
      out.push({ key: c.uuid, contractor: c, label: c.name })
      continue
    }
    for (const w of wos) {
      if (w.active) out.push({ key: w.uuid, contractor: c, workOrder: w, label: `${c.name} · WO ${w.number}` })
    }
  }
  return out
}

/**
 * Tickets that count for a subject: its work order's tickets; contractor-level
 * tickets (no work order) count when the contractor has a single work order
 * or no work orders at all (only active work orders are counted: see holdsContractorTickets).
 */
export function subjectTickets(s: KpiSubject, tickets: Ticket[], workOrders: WorkOrder[]): Ticket[] {
  const mine = tickets.filter((t) => t.contractorUuid === s.contractor.uuid)
  if (!s.workOrder) return mine
  return mine.filter((t) => t.workOrderUuid === s.workOrder!.uuid || (!t.workOrderUuid && holdsContractorTickets(s.workOrder!, workOrders)))
}

/**
 * Tickets logged without a work order belong to a work order when it is the
 * contractor's only one, or its only active one (a switched-off work order
 * doesn't split them away). With two or more active, they stay unscored and
 * the ticket sheet asks for the work order.
 */
export function holdsContractorTickets(wo: WorkOrder, workOrders: WorkOrder[]): boolean {
  const all = workOrders.filter((w) => w.contractorUuid === wo.contractorUuid)
  if (all.length === 1) return all[0].uuid === wo.uuid
  const active = all.filter((w) => w.active)
  return active.length === 1 && active[0].uuid === wo.uuid
}

export const subjectKpi = (s: KpiSubject, kpis: KpiMonth[], month: string) =>
  kpis.find((k) => k.contractorUuid === s.contractor.uuid && (k.workOrderUuid || '') === woOf(s) && k.month === month)

/** One subject's months (documents marked "not applicable" carry on from them). */
export const subjectRows = (s: KpiSubject, kpis: KpiMonth[]) =>
  kpis.filter((k) => k.contractorUuid === s.contractor.uuid && (k.workOrderUuid || '') === woOf(s))

/** What carries into `month` for the documents ("not applicable" until changed): pass as `prev`. */
export const subjectPrior = (s: KpiSubject, kpis: KpiMonth[], month: string) => carryBefore(subjectRows(s, kpis), month)

/** Every document answered for the month (in, not provided or not applicable). */
export const docsSettled = (s: KpiSubject, kpis: KpiMonth[], month: string) => allSettled(subjectKpi(s, kpis, month), subjectPrior(s, kpis, month), month)

export const subjectManpower = (s: KpiSubject, rows: Manpower[], month: string) =>
  rows.find((m) => m.contractorUuid === s.contractor.uuid && (m.workOrderUuid || '') === woOf(s) && m.month === month)

/** A blank KPI month for one subject. */
export function emptyKpi(contractorUuid: string, workOrderUuid: string, month: string): KpiMonth {
  return {
    uuid: newUuid(),
    updatedAt: '',
    contractorUuid,
    workOrderUuid,
    month,
    wps: false,
    manpowerDecl: false,
    salaryDecl: false,
    accommodationPct: null,
    onboardingPct: null,
    offboardingPct: null,
    meetingPct: null,
    quarterlyAuditPct: null,
  }
}

/** A blank manpower count for one subject. */
export function emptyManpower(contractorUuid: string, workOrderUuid: string, month: string): Manpower {
  return {
    uuid: newUuid(),
    updatedAt: '',
    contractorUuid,
    workOrderUuid,
    month,
    totalWorkers: 0,
    illegalOrFreelance: 0,
    visaExpiring30d: 0,
    paidRecruitmentFees: 0,
  }
}
