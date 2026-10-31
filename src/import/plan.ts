import { db, newUuid } from '../db'
import { activityEntry, nowIso } from '../lib/records'
import { sameCompany } from '../lib/names'
import { TICKET_PREFIX } from '../lib/lists'
import { unifyNames } from './clean'
import type { RawKpi, RawTicket, ReadResult, Skipped } from './readers'
import type { ActivityEntry, Contractor, KpiMonth, Ticket, WeeklyCount, WorkOrder } from '../types'

export const NEW = 'new'

export interface MasterWorkOrder {
  uuid: string
  number: string
  active: boolean
  existing: boolean
}

/** A contractor (company) the import knows, with its work orders. */
export interface MasterContractor {
  uuid: string
  name: string
  active: boolean
  aliases: string[]
  existing: boolean
  workOrders: MasterWorkOrder[]
}

/** Spellings of one company found in tickets, and where they should go. */
export interface ContractorGroup {
  id: string
  variants: string[]
  tickets: number
  /** uuid of a master contractor, or NEW */
  target: string
  newName: string
}

export interface ImportPlan {
  masters: MasterContractor[]
  groups: ContractorGroup[]
  /** KPI-file name (e.g. "Al Fahad-882") → contractor + work order. */
  kpiNames: Record<string, { contractorUuid: string; workOrderUuid: string }>
  tickets: RawTicket[]
  kpis: RawKpi[]
  weekly: { weekEnding: string; openTickets: number }[]
  skipped: Skipped[]
  notes: string[]
}

const lower = (s: string) => s.trim().toLowerCase()
const matchesMaster = (name: string, m: MasterContractor) =>
  lower(m.name) === lower(name) || m.aliases.some((a) => lower(a) === lower(name))

/** "Al Fahad-882" → { base: "Al Fahad", number: "882" }; no trailing number → number ''. */
export function splitWorkOrder(name: string): { base: string; number: string } {
  const m = name.trim().match(/^(.*?)[\s\-–_#]*(\d{3,6})$/)
  if (m && m[1].trim()) return { base: m[1].trim(), number: m[2] }
  return { base: name.trim(), number: '' }
}

export function buildPlan(results: ReadResult[], existing: Contractor[], existingWos: WorkOrder[] = []): ImportPlan {
  const masters: MasterContractor[] = existing.map((c) => ({
    uuid: c.uuid,
    name: c.name,
    active: c.active,
    aliases: c.aliases,
    existing: true,
    workOrders: existingWos
      .filter((w) => w.contractorUuid === c.uuid)
      .map((w) => ({ uuid: w.uuid, number: w.number, active: w.active, existing: true })),
  }))
  const kpiNames: ImportPlan['kpiNames'] = {}

  // KPI master names carry the work order: "Al Fahad-882", "Al Fahad 823" → Al Fahad + 2 WOs.
  const addKpiName = (full: string, active = true) => {
    if (!full || kpiNames[full]) return
    const { base, number } = splitWorkOrder(full)
    let m = masters.find((x) => matchesMaster(base, x))
    if (!m) {
      m = { uuid: newUuid(), name: base, active: false, aliases: [], existing: false, workOrders: [] }
      masters.push(m)
    }
    if (!m.existing && active) m.active = true
    let woUuid = ''
    if (number) {
      let wo = m.workOrders.find((w) => w.number === number)
      if (!wo) {
        wo = { uuid: newUuid(), number, active, existing: false }
        m.workOrders.push(wo)
      }
      woUuid = wo.uuid
    }
    kpiNames[full] = { contractorUuid: m.uuid, workOrderUuid: woUuid }
  }
  for (const r of results) for (const c of r.contractors) addKpiName(c.name, c.active)
  for (const r of results) for (const k of r.kpis) addKpiName(k.contractor)

  const tickets = results.flatMap((r) => r.tickets)
  const people = unifyNames(tickets.map((t) => t.assignedTo).filter(Boolean))
  for (const t of tickets) if (t.assignedTo) t.assignedTo = people.get(t.assignedTo) ?? t.assignedTo

  // Ticket contractor spellings not already known → groups of the same company.
  const counts = new Map<string, number>()
  for (const t of tickets) if (t.contractor) counts.set(t.contractor, (counts.get(t.contractor) ?? 0) + 1)
  const groups: ContractorGroup[] = []
  for (const name of [...counts.keys()].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))) {
    if (kpiNames[name] || masters.some((m) => matchesMaster(name, m))) continue
    const g = groups.find((x) => x.variants.some((v) => sameCompany(v, name)))
    if (g) {
      g.variants.push(name)
      g.tickets += counts.get(name) ?? 0
    } else {
      groups.push({ id: newUuid(), variants: [name], tickets: counts.get(name) ?? 0, target: NEW, newName: name })
    }
  }
  for (const g of groups) {
    const hits = masters.filter((m) => g.variants.some((v) => [m.name, ...m.aliases].some((n) => sameCompany(n, v))))
    if (hits.length === 1) g.target = hits[0].uuid
  }

  const notes: string[] = []
  const est = tickets.filter((t) => t.closedEstimated).length
  if (est) notes.push(`${est} closing dates estimated from the weekly tabs`)
  for (const r of results) if (r.note) notes.push(r.note)

  return {
    masters,
    groups,
    kpiNames,
    tickets,
    kpis: results.flatMap((r) => r.kpis),
    weekly: results.flatMap((r) => r.weekly),
    skipped: results.flatMap((r) => r.skipped),
    notes,
  }
}

export interface ImportSummary {
  contractors: number
  workOrders: number
  tickets: number
  kpis: number
  weeks: number
  duplicates: number
}

export interface ExistingRecords {
  contractors: Contractor[]
  workOrders: WorkOrder[]
  tickets: Ticket[]
  kpiMonths: KpiMonth[]
  weeklyCounts: WeeklyCount[]
}

export interface PlannedRecords {
  /** All contractors to write (existing ones updated with new aliases, plus new ones). */
  contractors: Contractor[]
  workOrders: WorkOrder[]
  tickets: Ticket[]
  kpiMonths: KpiMonth[]
  weeklyCounts: WeeklyCount[]
  activity: ActivityEntry
  summary: ImportSummary
}

/** Next free internal number: WWCMPL-INT-0001, 0002… */
function internalNumbers(existing: Ticket[]) {
  let n = 0
  for (const t of existing) {
    const m = t.ticketNo.match(/-INT-(\d+)$/)
    if (m) n = Math.max(n, Number(m[1]))
  }
  return () => `${TICKET_PREFIX}-INT-${String(++n).padStart(4, '0')}`
}

/**
 * Turn a plan into records (pure — no database): resolves every contractor
 * spelling and work order, skips tickets / KPI months / weeks that already exist.
 */
export function planToRecords(plan: ImportPlan, existing: ExistingRecords, now = nowIso()): PlannedRecords {
  const summary: ImportSummary = { contractors: 0, workOrders: 0, tickets: 0, kpis: 0, weeks: 0, duplicates: 0 }
  const byUuid = new Map(existing.contractors.map((c) => [c.uuid, c]))
  const workOrders: WorkOrder[] = []
  for (const m of plan.masters) {
    if (!m.existing) {
      byUuid.set(m.uuid, { uuid: m.uuid, updatedAt: now, name: m.name, active: m.active, aliases: [], notes: '' })
      summary.contractors++
    }
    for (const w of m.workOrders) {
      if (w.existing) continue
      workOrders.push({ uuid: w.uuid, updatedAt: now, contractorUuid: m.uuid, number: w.number, label: '', active: w.active, notes: '' })
      summary.workOrders++
    }
  }
  const resolve = new Map<string, { contractorUuid: string; workOrderUuid: string }>()
  for (const m of plan.masters) {
    for (const n of [m.name, ...m.aliases]) resolve.set(lower(n), { contractorUuid: m.uuid, workOrderUuid: '' })
  }
  for (const [name, ref] of Object.entries(plan.kpiNames)) resolve.set(lower(name), ref)
  for (const g of plan.groups) {
    let uuid = g.target
    if (uuid === NEW) {
      uuid = newUuid()
      const name = g.newName.trim() || g.variants[0]
      // Only the KPI System's companies start active; ticket-only companies start inactive.
      byUuid.set(uuid, { uuid, updatedAt: now, name, active: false, aliases: [], notes: '' })
      summary.contractors++
    }
    const c = byUuid.get(uuid)!
    const aliases = new Set(c.aliases)
    for (const v of g.variants) if (lower(v) !== lower(c.name)) aliases.add(v)
    byUuid.set(uuid, { ...c, aliases: [...aliases], updatedAt: now })
    for (const v of g.variants) resolve.set(lower(v), { contractorUuid: uuid, workOrderUuid: '' })
  }

  const ticketNos = new Set(existing.tickets.map((t) => t.ticketNo).filter(Boolean))
  const internalKey = (t: { contractorUuid: string; openedAt: string; issue: string }) =>
    `${t.contractorUuid}|${t.openedAt}|${t.issue}`
  const internalKeys = new Set(existing.tickets.filter((t) => t.source === 'Internal').map(internalKey))
  const nextInternal = internalNumbers(existing.tickets)
  const tickets: Ticket[] = []
  for (const r of plan.tickets) {
    const ref = resolve.get(lower(r.contractor)) ?? { contractorUuid: '', workOrderUuid: '' }
    const t: Ticket = {
      uuid: newUuid(),
      updatedAt: now,
      source: r.source,
      ticketNo: r.ticketNo,
      channel: r.channel,
      contractorUuid: ref.contractorUuid,
      workOrderUuid: ref.workOrderUuid,
      subcontractor: r.subcontractor,
      category: r.category,
      issue: r.issue,
      priority: r.priority,
      severity: r.severity,
      workers: r.workers,
      violations: r.violations,
      amountOwed: null,
      assignedTo: r.assignedTo,
      status: r.status,
      openedAt: r.openedAt,
      closedAt: r.closedAt,
      contractorAction: r.contractorAction,
      wwAction: r.wwAction,
      notes: r.closedEstimated ? 'Closing date estimated from the weekly log.' : '',
    }
    const dup = t.ticketNo ? ticketNos.has(t.ticketNo) : internalKeys.has(internalKey(t))
    if (dup) {
      summary.duplicates++
      continue
    }
    if (!t.ticketNo) {
      internalKeys.add(internalKey(t))
      t.ticketNo = nextInternal()
    }
    ticketNos.add(t.ticketNo)
    tickets.push(t)
  }
  summary.tickets = tickets.length

  const haveKpi = new Set(existing.kpiMonths.map((k) => `${k.contractorUuid}|${k.workOrderUuid || ''}|${k.month}`))
  const kpiMonths: KpiMonth[] = []
  for (const k of plan.kpis) {
    const ref = resolve.get(lower(k.contractor))
    if (!ref) continue
    const key = `${ref.contractorUuid}|${ref.workOrderUuid}|${k.month}`
    if (haveKpi.has(key)) {
      summary.duplicates++
      continue
    }
    haveKpi.add(key)
    kpiMonths.push({
      uuid: newUuid(),
      updatedAt: now,
      contractorUuid: ref.contractorUuid,
      workOrderUuid: ref.workOrderUuid,
      month: k.month,
      wps: k.wps,
      manpowerDecl: k.manpowerDecl,
      salaryDecl: k.salaryDecl,
      accommodationPct: k.accommodationPct,
      onboardingPct: k.onboardingPct,
      offboarded: null,
      offboardTotal: null,
      meetingPct: k.meetingPct,
      quarterlyAuditPct: k.quarterlyAuditPct,
      legacy: { offboardingPct: k.offboardingPct, formalPct: k.formalPct },
    })
  }
  summary.kpis = kpiMonths.length

  const haveWeek = new Set(existing.weeklyCounts.map((w) => w.weekEnding))
  const weeklyCounts: WeeklyCount[] = plan.weekly
    .filter((w) => !haveWeek.has(w.weekEnding))
    .map((w) => ({ uuid: newUuid(), updatedAt: now, weekEnding: w.weekEnding, openTickets: w.openTickets }))
  summary.weeks = weeklyCounts.length

  const activity = {
    ...activityEntry(
      'import',
      newUuid(),
      'import',
      `History import · ${summary.tickets} tickets · ${summary.contractors} contractors · ${summary.workOrders} work orders · ${summary.kpis} KPI months · ${summary.weeks} weeks`,
    ),
    time: now,
  }
  return { contractors: [...byUuid.values()], workOrders, tickets, kpiMonths, weeklyCounts, activity, summary }
}

/** Save the plan in one transaction, with one activity entry for the whole import. */
export async function applyPlan(plan: ImportPlan): Promise<ImportSummary> {
  let summary: ImportSummary | null = null
  await db.transaction(
    'rw',
    [db.contractors, db.workOrders, db.tickets, db.kpiMonths, db.weeklyCounts, db.activity],
    async () => {
      const r = planToRecords(plan, {
        contractors: await db.contractors.toArray(),
        workOrders: await db.workOrders.toArray(),
        tickets: await db.tickets.toArray(),
        kpiMonths: await db.kpiMonths.toArray(),
        weeklyCounts: await db.weeklyCounts.toArray(),
      })
      await db.contractors.bulkPut(r.contractors)
      await db.workOrders.bulkAdd(r.workOrders)
      await db.tickets.bulkAdd(r.tickets)
      await db.kpiMonths.bulkAdd(r.kpiMonths)
      await db.weeklyCounts.bulkAdd(r.weeklyCounts)
      await db.activity.add(r.activity)
      summary = r.summary
    },
  )
  return summary!
}
