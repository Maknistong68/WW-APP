import { TICKET_PREFIX, validTicketNo } from './lists'
import type { Ticket } from '../types'

type Fields = Pick<Ticket, 'ticketNo' | 'contractorUuid' | 'issue' | 'status' | 'openedAt' | 'closedAt'>

/**
 * What stops a ticket from saving, or null. A new ticket needs its number,
 * contractor and issue. An existing one is only held to the fields it had:
 * old imported tickets with gaps can still be edited (e.g. just the workers),
 * but a field that had a value can't be emptied.
 */
export function ticketProblem(before: Fields | null, after: Fields): string | null {
  const isNew = !before
  const had = (k: 'ticketNo' | 'contractorUuid' | 'issue') => isNew || !!before[k]?.trim()
  if (had('ticketNo') && !validTicketNo(after.ticketNo)) return `Complete the ticket number (${TICKET_PREFIX}…)`
  if (had('contractorUuid') && !after.contractorUuid) return 'Pick a contractor'
  if (had('issue') && !after.issue) return 'Pick an issue'
  if (after.status === 'Closed') {
    if (!after.closedAt) return 'Add the closing date'
    if (after.openedAt && after.closedAt < after.openedAt) return 'Closing date is before the opening date'
  }
  return null
}
