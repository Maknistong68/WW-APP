import type { Ticket } from '../types'

// Related tickets closed in one go: one main ticket holds the money, the
// others point at it with parentUuid, so totals count the payment once.

/** Main ticket and the tickets combined into it. */
export interface TicketGroup {
  main: Ticket
  members: Ticket[]
  /** main + members */
  all: Ticket[]
  workers: number
}

/** The group a ticket belongs to (a standalone ticket is a group of one). */
export function groupOf(t: Ticket, tickets: Ticket[]): TicketGroup {
  const main = t.parentUuid ? (tickets.find((x) => x.uuid === t.parentUuid) ?? t) : t
  const members = tickets.filter((x) => x.parentUuid === main.uuid && x.uuid !== main.uuid)
  const all = [main, ...members]
  return { main, members, all, workers: all.reduce((s, x) => s + (x.workers || 0), 0) }
}

/** Number of tickets combined into each main ticket. */
export function memberCounts(tickets: Ticket[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const t of tickets) if (t.parentUuid) m.set(t.parentUuid, (m.get(t.parentUuid) ?? 0) + 1)
  return m
}

/** Suggested main ticket: the most workers, then the newest. */
export function suggestMain(tickets: Ticket[]): Ticket {
  return [...tickets].sort((a, b) => (b.workers || 0) - (a.workers || 0) || b.openedAt.localeCompare(a.openedAt))[0]
}

export interface CloseTogether {
  mainUuid: string
  /** Total SAR paid at closure (null = not known). */
  amount: number | null
  closedAt: string
  contractorAction: string
  wwAction: string
  /** false = only combine, keep the tickets open. */
  close: boolean
}

/**
 * Updated records for combining (and optionally closing) tickets. Tickets
 * already in other groups are pulled into this one; their old main's members
 * follow too. The money moves to the main ticket only.
 */
export function combineTickets(selected: Ticket[], all: Ticket[], opts: CloseTogether): Ticket[] {
  const main = selected.find((t) => t.uuid === opts.mainUuid)
  if (!main) throw new Error('Main ticket must be one of the selected tickets')
  // whole groups move together
  const ids = new Set<string>()
  for (const t of selected) for (const g of groupOf(t, all).all) ids.add(g.uuid)
  const group = all.filter((t) => ids.has(t.uuid))
  const mainNo = main.ticketNo
  return group.map((t) => {
    const isMain = t.uuid === main.uuid
    const closing = opts.close
      ? {
          status: 'Closed' as const,
          closedAt: opts.closedAt,
          contractorAction: opts.contractorAction || t.contractorAction,
          wwAction: opts.wwAction || t.wwAction,
        }
      : {}
    if (isMain) return { ...t, ...closing, parentUuid: '', amountOwed: opts.amount ?? t.amountOwed }
    const note = `Combined with ${mainNo}`
    return {
      ...t,
      ...closing,
      parentUuid: main.uuid,
      amountOwed: null,
      notes: t.notes.includes(note) ? t.notes : [t.notes, note].filter(Boolean).join(' · '),
    }
  })
}

/** Take a ticket out of its group (it keeps its own status). */
export function uncombine(t: Ticket, mainNo: string): Ticket {
  const note = `Combined with ${mainNo}`
  return {
    ...t,
    parentUuid: '',
    notes: t.notes
      .split(' · ')
      .filter((n) => n !== note)
      .join(' · '),
  }
}
