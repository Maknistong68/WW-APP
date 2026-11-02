import { CASE_PREFIX, isCase, validCaseNo } from './cases'
import { TICKET_PREFIX, validTicketNo } from './lists'
import type { Ticket } from '../types'

type Fields = Pick<Ticket, 'ticketNo' | 'contractorUuid' | 'issue' | 'status' | 'openedAt' | 'closedAt'> & Partial<Pick<Ticket, 'source'>>

/**
 * What stops a ticket (or case) from saving, or null. A new one needs its
 * number, contractor and issue. An existing one is only held to the fields it
 * had: old imported tickets with gaps can still be edited (e.g. just the
 * workers), but a field that had a value can't be emptied. A D&C ticket's
 * number starts WWCMPL; a case's is CASE-0001 and so on.
 */
export function ticketProblem(before: Fields | null, after: Fields): string | null {
  const isNew = !before
  const had = (k: 'ticketNo' | 'contractorUuid' | 'issue') => isNew || !!before[k]?.trim()
  if (had('ticketNo')) {
    if (isCase(after) && !validCaseNo(after.ticketNo)) return `Complete the case number (${CASE_PREFIX}…)`
    if (!isCase(after) && !validTicketNo(after.ticketNo)) return `Complete the ticket number (${TICKET_PREFIX}…)`
  }
  if (had('contractorUuid') && !after.contractorUuid) return 'Pick a contractor'
  if (had('issue') && !after.issue) return 'Pick an issue'
  if (after.status === 'Closed') {
    if (!after.closedAt) return 'Add the closing date'
    if (after.openedAt && after.closedAt < after.openedAt) return 'Closing date is before the opening date'
  }
  return null
}
