import { isOpen } from './aging'
import { isCase } from './cases'
import { CATEGORIES } from './lists'
import type { Ticket } from '../types'

// ---------------------------------------------------------------------------
// A case (the team's own item) that couldn't be solved inside the project can
// turn into a D&C ticket from head office. The case is then linked to that
// ticket — it stays as it is (open until someone closes it), and the ticket
// shows which cases it came from. The link lives on the case only; the
// ticket's side is worked out from the cases, so linking never touches the
// D&C ticket or anything the KPIs read.
// ---------------------------------------------------------------------------

/** Link a case to the D&C ticket it turned into. */
export function linkCase(c: Ticket, t: Ticket): Ticket {
  if (!isCase(c)) throw new Error('Only a case can be linked to a D&C ticket')
  if (isCase(t)) throw new Error('A case links to a D&C ticket, not to another case')
  return { ...c, linkedTicketUuid: t.uuid }
}

/** Take the link off (no empty field left behind). */
export function unlinkCase(c: Ticket): Ticket {
  const out = { ...c }
  delete out.linkedTicketUuid
  return out
}

/** The D&C ticket a case turned into (undefined: not linked, or that ticket was removed). */
export const linkedTicket = (c: Ticket, all: Ticket[]) => (c.linkedTicketUuid ? all.find((t) => t.uuid === c.linkedTicketUuid) : undefined)

/** The cases that turned into this D&C ticket. */
export const casesFor = (ticketUuid: string, all: Ticket[]) => all.filter((t) => isCase(t) && t.linkedTicketUuid === ticketUuid)

/** D&C ticket uuid → the cases linked to it (one pass for a whole list). */
export function linkIndex(all: Ticket[]): Map<string, Ticket[]> {
  const out = new Map<string, Ticket[]>()
  for (const t of all) {
    if (!isCase(t) || !t.linkedTicketUuid) continue
    const list = out.get(t.linkedTicketUuid)
    if (list) list.push(t)
    else out.set(t.linkedTicketUuid, [t])
  }
  return out
}

/** The chip on a row: "→ WWCMPL-123" on a case, "From CASE-0004" / "From 2 cases" on a ticket. */
export function linkText(t: Ticket, index: Map<string, Ticket[]>, byUuid: Map<string, Ticket>): string {
  if (isCase(t)) {
    if (!t.linkedTicketUuid) return ''
    const to = byUuid.get(t.linkedTicketUuid)
    return to ? `→ ${to.ticketNo}` : '→ ticket removed'
  }
  const from = index.get(t.uuid) ?? []
  if (!from.length) return ''
  return from.length === 1 ? `From ${from[0].ticketNo}` : `From ${from.length} cases`
}

const fold = (s: string) => s.toLowerCase().replace(/[\s-]+/g, '')

/**
 * The D&C tickets to pick from: open ones, the case's own contractor first,
 * newest first. Typing searches the number or the contractor and also finds
 * closed tickets (listed after the open ones).
 */
export function pickerTickets(c: Ticket, all: Ticket[], query: string, nameOf: (contractorUuid: string) => string): Ticket[] {
  const q = fold(query.trim())
  const hits = all.filter((t) => {
    if (isCase(t)) return false
    if (!q) return isOpen(t)
    return fold(t.ticketNo).includes(q) || fold(nameOf(t.contractorUuid)).includes(q)
  })
  return hits.sort(
    (a, b) =>
      Number(!isOpen(a)) - Number(!isOpen(b)) ||
      Number(b.contractorUuid === c.contractorUuid) - Number(a.contractorUuid === c.contractorUuid) ||
      b.openedAt.localeCompare(a.openedAt),
  )
}

/** A new D&C ticket that starts from the case: who, where, what and how many; the hotline number is typed. */
export function ticketFromCase(c: Ticket, base: Ticket): Ticket {
  return {
    ...base,
    source: 'System',
    contractorUuid: c.contractorUuid,
    workOrderUuid: c.workOrderUuid,
    subcontractor: c.subcontractor,
    issue: c.issue,
    workers: c.workers,
    violations: c.violations,
    category: (CATEGORIES as readonly string[]).includes(c.category) ? c.category : base.category,
    notes: `From ${c.ticketNo}`,
  }
}

/** Open cases linked to any of these D&C tickets (asked about when the tickets close). */
export const openLinkedCases = (ticketUuids: string[], all: Ticket[]) => {
  const set = new Set(ticketUuids)
  return all.filter((t) => isCase(t) && isOpen(t) && !!t.linkedTicketUuid && set.has(t.linkedTicketUuid))
}

/** Close a case together with the D&C ticket it turned into. Its money stays as it was. */
export function closeLinkedCase(c: Ticket, ticket: Ticket, date: string): Ticket {
  const note = `Closed with ${ticket.ticketNo}`
  return {
    ...c,
    status: 'Closed',
    closedAt: c.openedAt && date < c.openedAt ? c.openedAt : date,
    wwAction: c.wwAction.trim() ? `${c.wwAction.trim()}\n${note}` : note,
  }
}

/** Cases opened in the month (null = all time), and how many of them turned into D&C tickets. */
export function turnedIntoTickets(cases: Ticket[], month: string | null): { total: number; linked: number; notLinked: number } {
  const mine = month ? cases.filter((c) => c.openedAt.slice(0, 7) === month) : cases
  const linked = mine.filter((c) => !!c.linkedTicketUuid).length
  return { total: mine.length, linked, notLinked: mine.length - linked }
}
