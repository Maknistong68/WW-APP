import { CASE_PREFIX, isCase, validCaseNo } from './cases'
import { TICKET_PREFIX, validTicketNo } from './lists'
import { localDate } from './dates'
import type { Ticket } from '../types'

type Fields = Pick<Ticket, 'ticketNo' | 'contractorUuid' | 'issue' | 'status' | 'openedAt' | 'closedAt'> & Partial<Pick<Ticket, 'source'>>

/**
 * What stops a ticket (or case) from saving, or null. A new one needs its
 * number, contractor and issue. An existing one is only held to the fields it
 * had: old imported tickets with gaps can still be edited (e.g. just the
 * workers), but a field that had a value can't be emptied. A D&C ticket's
 * number starts WWCMPL; a case's is CASE-0001 and so on. The dates are held
 * the same way: a closed ticket imported with a missing or backwards closing
 * date still saves, until someone touches its status or dates.
 */
export function ticketProblem(before: Fields | null, after: Fields, today: string = localDate()): string | null {
  const isNew = !before
  const had = (k: 'ticketNo' | 'contractorUuid' | 'issue') => isNew || !!before[k]?.trim()
  if (had('ticketNo')) {
    if (isCase(after) && !validCaseNo(after.ticketNo)) return `Complete the case number (${CASE_PREFIX}…)`
    if (!isCase(after) && !validTicketNo(after.ticketNo)) return `Complete the ticket number (${TICKET_PREFIX}…)`
  }
  if (had('contractorUuid') && !after.contractorUuid) return 'Pick a contractor'
  if (had('issue') && !after.issue) return 'Pick an issue'
  const datesTouched =
    isNew ||
    before.status !== after.status ||
    before.openedAt !== after.openedAt ||
    before.closedAt !== after.closedAt ||
    !dateProblem(before, today)
  if (datesTouched) return dateProblem(after, today)
  return null
}

function dateProblem(t: Fields, today: string = localDate()): string | null {
  // Without an opening date a ticket never ages, never goes late and counts 0 days in Grievance.
  if (!t.openedAt) return 'Add the opening date'
  if (t.openedAt > today) return 'Opening date is in the future'
  if (t.status !== 'Closed') return null
  if (!t.closedAt) return 'Add the closing date'
  if (t.closedAt < t.openedAt) return 'Closing date is before the opening date'
  if (t.closedAt > today) return 'Closing date is in the future'
  return null
}

/** A gentle note under the dates of a ticket whose dates look wrong (old imports). */
export function ticketDateHint(t: Fields): string | null {
  const p = dateProblem(t)
  if (!p) return null
  if (p === 'Add the closing date') return 'No closing date'
  if (p === 'Add the opening date') return 'No opening date'
  if (p === 'Closing date is before the opening date') return 'Check the dates: closed before it was opened'
  return 'Check the dates'
}

/**
 * Numbers used by more than one ticket or case (two people offline can both
 * take CASE-0012). Bare prefixes and blanks are ignored. Sorted for display.
 */
export function duplicateNumbers(tickets: Pick<Ticket, 'ticketNo'>[]): string[] {
  const seen = new Map<string, number>()
  for (const t of tickets) {
    const no = t.ticketNo.trim().toUpperCase()
    if (!no || no === TICKET_PREFIX || no === CASE_PREFIX) continue
    seen.set(no, (seen.get(no) ?? 0) + 1)
  }
  return [...seen].filter(([, n]) => n > 1).map(([no]) => no).sort()
}
