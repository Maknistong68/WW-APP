import { db, newUuid } from '../db'
import { activityEntry, nowIso } from '../lib/records'
import { sameCompany } from '../lib/names'
import { unifyNames } from './clean'
import type { RawKpi, RawTicket, ReadResult, Skipped } from './readers'
import type { Contractor, KpiMonth, Ticket, WeeklyCount } from '../types'

export const NEW = 'new'

export interface MasterContractor {
  uuid: string
  name: string
  active: boolean
  aliases: string[]
  existing: boolean
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
  tickets: RawTicket[]
  kpis: RawKpi[]
  weekly: { weekEnding: string; openTickets: number }[]
  skipped: Skipped[]
  notes: string[]
}

const lower = (s: string) => s.trim().toLowerCase()
const matchesMaster = (name: string, m: MasterContractor) =>
  lower(m.name) === lower(name) || m.aliases.some((a) => lower(a) === lower(name))

export function buildPlan(results: ReadResult[], existing: Contractor[]): ImportPlan {
  const masters: MasterContractor[] = existing.map((c) => ({
    uuid: c.uuid,
    name: c.name,
    active: c.active,
    aliases: c.aliases,
    existing: true,
  }))
  const addMaster = (name: string, active = true) => {
    if (!name || masters.some((m) => matchesMaster(name, m))) return
    masters.push({ uuid: newUuid(), name, active, aliases: [], existing: false })
  }
  for (const r of results) for (const c of r.contractors) addMaster(c.name, c.active)
  for (const r of results) for (const k of r.kpis) addMaster(k.contractor)

  const tickets = results.flatMap((r) => r.tickets)
  const people = unifyNames(tickets.map((t) => t.assignedTo).filter(Boolean))
  for (const t of tickets) if (t.assignedTo) t.assignedTo = people.get(t.assignedTo) ?? t.assignedTo

  // Ticket contractor spellings not already known → groups of the same company.
  const counts = new Map<string, number>()
  for (const t of tickets) if (t.contractor) counts.set(t.contractor, (counts.get(t.contractor) ?? 0) + 1)
  const groups: ContractorGroup[] = []
  for (const name of [...counts.keys()].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))) {
    if (masters.some((m) => matchesMaster(name, m))) continue
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
    // One clear match → link it. Several (e.g. one company with 3 camps) → owner decides.
    if (hits.length === 1) g.target = hits[0].uuid
  }

  const notes: string[] = []
  const est = tickets.filter((t) => t.closedEstimated).length
  if (est) notes.push(`${est} closing dates estimated from the weekly tabs`)
  for (const r of results) if (r.note) notes.push(r.note)

  return {
    masters,
    groups,
    tickets,
    kpis: results.flatMap((r) => r.kpis),
    weekly: results.flatMap((r) => r.weekly),
    skipped: results.flatMap((r) => r.skipped),
    notes,
  }
}

export interface ImportSummary {
  contractors: number
  tickets: number
  kpis: number
  weeks: number
  duplicates: number
}

/** Save the plan in one transaction, with one activity entry for the whole import. */
export async function applyPlan(plan: ImportPlan): Promise<ImportSummary> {
  const now = nowIso()
  const summary: ImportSummary = { contractors: 0, tickets: 0, kpis: 0, weeks: 0, duplicates: 0 }
  await db.transaction('rw', [db.contractors, db.tickets, db.kpiMonths, db.weeklyCounts, db.activity], async () => {
    const byUuid = new Map((await db.contractors.toArray()).map((c) => [c.uuid, c]))
    for (const m of plan.masters) {
      if (m.existing) continue
      const wo = m.name.match(/(\d{3,})\s*$/)?.[1] ?? ''
      byUuid.set(m.uuid, { uuid: m.uuid, updatedAt: now, name: m.name, workOrder: wo, active: m.active, aliases: [], notes: '' })
      summary.contractors++
    }
    const resolve = new Map<string, string>()
    for (const m of plan.masters) for (const n of [m.name, ...m.aliases]) resolve.set(lower(n), m.uuid)
    for (const g of plan.groups) {
      let uuid = g.target
      if (uuid === NEW) {
        uuid = newUuid()
        const name = g.newName.trim() || g.variants[0]
        // Only the KPI System's master list is KPI-tracked; ticket-only companies start untracked.
        byUuid.set(uuid, { uuid, updatedAt: now, name, workOrder: '', active: false, aliases: [], notes: '' })
        summary.contractors++
      }
      const c = byUuid.get(uuid)!
      const aliases = new Set(c.aliases)
      for (const v of g.variants) if (lower(v) !== lower(c.name)) aliases.add(v)
      byUuid.set(uuid, { ...c, aliases: [...aliases], updatedAt: now })
      for (const v of g.variants) resolve.set(lower(v), uuid)
    }
    await db.contractors.bulkPut([...byUuid.values()])

    const existing = await db.tickets.toArray()
    const ticketNos = new Set(existing.map((t) => t.ticketNo).filter(Boolean))
    const internalKey = (t: { contractorUuid: string; openedAt: string; issue: string }) =>
      `${t.contractorUuid}|${t.openedAt}|${t.issue}`
    const internalKeys = new Set(existing.filter((t) => !t.ticketNo).map(internalKey))
    const rows: Ticket[] = []
    for (const r of plan.tickets) {
      const t: Ticket = {
        uuid: newUuid(),
        updatedAt: now,
        source: r.source,
        ticketNo: r.ticketNo,
        channel: r.channel,
        contractorUuid: resolve.get(lower(r.contractor)) ?? '',
        subcontractor: r.subcontractor,
        category: r.category,
        issue: r.issue,
        priority: r.priority,
        severity: r.severity,
        workers: r.workers,
        violations: r.violations,
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
      if (t.ticketNo) ticketNos.add(t.ticketNo)
      else internalKeys.add(internalKey(t))
      rows.push(t)
    }
    await db.tickets.bulkAdd(rows)
    summary.tickets = rows.length

    const haveKpi = new Set((await db.kpiMonths.toArray()).map((k) => `${k.contractorUuid}|${k.month}`))
    const kpis: KpiMonth[] = []
    for (const k of plan.kpis) {
      const contractorUuid = resolve.get(lower(k.contractor))
      if (!contractorUuid) continue
      const key = `${contractorUuid}|${k.month}`
      if (haveKpi.has(key)) {
        summary.duplicates++
        continue
      }
      haveKpi.add(key)
      kpis.push({
        uuid: newUuid(),
        updatedAt: now,
        contractorUuid,
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
    await db.kpiMonths.bulkAdd(kpis)
    summary.kpis = kpis.length

    const haveWeek = new Set((await db.weeklyCounts.toArray()).map((w) => w.weekEnding))
    const weeks: WeeklyCount[] = plan.weekly
      .filter((w) => !haveWeek.has(w.weekEnding))
      .map((w) => ({ uuid: newUuid(), updatedAt: now, weekEnding: w.weekEnding, openTickets: w.openTickets }))
    await db.weeklyCounts.bulkAdd(weeks)
    summary.weeks = weeks.length

    await db.activity.add(
      activityEntry(
        'import',
        newUuid(),
        'import',
        `History import · ${summary.tickets} tickets · ${summary.contractors} contractors · ${summary.kpis} KPI months · ${summary.weeks} weeks`,
      ),
    )
  })
  return summary
}
