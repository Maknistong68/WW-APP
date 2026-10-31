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
 * or no work orders at all.
 */
export function subjectTickets(s: KpiSubject, tickets: Ticket[], workOrders: WorkOrder[]): Ticket[] {
  const mine = tickets.filter((t) => t.contractorUuid === s.contractor.uuid)
  if (!s.workOrder) return mine
  const single = workOrders.filter((w) => w.contractorUuid === s.contractor.uuid).length === 1
  return mine.filter((t) => t.workOrderUuid === s.workOrder!.uuid || (single && !t.workOrderUuid))
}

export const subjectKpi = (s: KpiSubject, kpis: KpiMonth[], month: string) =>
  kpis.find((k) => k.contractorUuid === s.contractor.uuid && (k.workOrderUuid || '') === woOf(s) && k.month === month)

export const subjectManpower = (s: KpiSubject, rows: Manpower[], month: string) =>
  rows.find((m) => m.contractorUuid === s.contractor.uuid && (m.workOrderUuid || '') === woOf(s) && m.month === month)
