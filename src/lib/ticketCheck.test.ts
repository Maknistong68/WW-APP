import { describe, expect, it } from 'vitest'
import { ticketProblem } from './ticketCheck'

const t = {
  ticketNo: 'WWCMPL-1101',
  contractorUuid: 'c1',
  issue: 'Salary delay',
  status: 'Closed' as const,
  openedAt: '2026-09-28',
  closedAt: '2026-10-20',
}
// an old imported ticket: no contractor, no issue
const old = { ...t, contractorUuid: '', issue: '', openedAt: '2024-12-03', closedAt: '2024-12-20' }

describe('Saving a ticket', () => {
  it('a new ticket needs its number, contractor and issue', () => {
    expect(ticketProblem(null, { ...t, ticketNo: 'WWCMPL' })).toMatch(/ticket number/)
    expect(ticketProblem(null, { ...t, contractorUuid: '' })).toBe('Pick a contractor')
    expect(ticketProblem(null, { ...t, issue: '' })).toBe('Pick an issue')
    expect(ticketProblem(null, t)).toBeNull()
  })
  it('an old ticket with gaps still saves (e.g. only the workers changed)', () => {
    expect(ticketProblem(old, old)).toBeNull()
  })
  it('but a field that had a value can’t be emptied', () => {
    expect(ticketProblem(t, { ...t, issue: '' })).toBe('Pick an issue')
    expect(ticketProblem(t, { ...t, contractorUuid: '' })).toBe('Pick a contractor')
  })
  it('a closed ticket needs a closing date on or after the opening date', () => {
    expect(ticketProblem(t, { ...t, closedAt: '2026-09-01' })).toBe('Closing date is before the opening date')
    expect(ticketProblem(t, { ...t, closedAt: '' })).toBe('Add the closing date')
    expect(ticketProblem(t, { ...t, status: 'Open', closedAt: '' })).toBeNull()
  })
})
