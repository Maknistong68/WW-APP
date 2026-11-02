import { describe, expect, it } from 'vitest'
import { duplicateNumbers, ticketDateHint, ticketProblem } from './ticketCheck'

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
  it('a case takes its own CASE- number; a D&C ticket still needs WWCMPL…', () => {
    const c = { ...t, source: 'Internal' as const, ticketNo: 'CASE-0003' }
    expect(ticketProblem(null, c)).toBeNull()
    expect(ticketProblem(null, { ...c, ticketNo: 'CASE-' })).toMatch(/case number/)
    expect(ticketProblem(null, { ...t, source: 'System', ticketNo: 'CASE-0003' })).toMatch(/ticket number/)
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
  it('an old ticket with bad dates still saves when the dates are not touched', () => {
    // imported with a placeholder opening date after the real closing date
    const backwards = { ...t, openedAt: '2024-12-16', closedAt: '2024-10-07' }
    expect(ticketProblem(backwards, { ...backwards, issue: 'Overtime' })).toBeNull()
    // closed with no closing date
    const undated = { ...t, closedAt: '' }
    expect(ticketProblem(undated, { ...undated, issue: 'Overtime' })).toBeNull()
  })
  it('touching the dates of such a ticket checks them again', () => {
    const backwards = { ...t, openedAt: '2024-12-16', closedAt: '2024-10-07' }
    expect(ticketProblem(backwards, { ...backwards, closedAt: '2024-10-08' })).toBe('Closing date is before the opening date')
    expect(ticketProblem(backwards, { ...backwards, openedAt: '2024-10-01' })).toBeNull()
    const open = { ...t, status: 'Open' as const, closedAt: '' }
    expect(ticketProblem(open, { ...open, status: 'Closed' })).toBe('Add the closing date')
  })
})

describe('A hint about dates that look wrong', () => {
  it('closed before it was opened, or closed with no date', () => {
    expect(ticketDateHint({ ...t, openedAt: '2024-12-16', closedAt: '2024-10-07' })).toBe('Check the dates: closed before it was opened')
    expect(ticketDateHint({ ...t, closedAt: '' })).toBe('No closing date')
  })
  it('nothing for good dates or open tickets', () => {
    expect(ticketDateHint(t)).toBeNull()
    expect(ticketDateHint({ ...t, status: 'Open', closedAt: '' })).toBeNull()
  })
  it('a ticket needs a real opening date, not in the future', () => {
    const base = { ticketNo: 'WWCMPL0001234', contractorUuid: 'c', issue: 'Food', status: 'Open' as const, closedAt: '' }
    expect(ticketProblem(null, { ...base, openedAt: '' }, '2026-11-02')).toBe('Add the opening date')
    expect(ticketProblem(null, { ...base, openedAt: '2026-11-03' }, '2026-11-02')).toBe('Opening date is in the future')
    expect(ticketProblem(null, { ...base, openedAt: '2026-11-02' }, '2026-11-02')).toBeNull()
    expect(ticketProblem(null, { ...base, status: 'Closed', openedAt: '2026-10-01', closedAt: '2026-11-05' }, '2026-11-02')).toBe('Closing date is in the future')
  })
})

describe('Numbers used twice', () => {
  it('finds a number two tickets or cases share, ignoring blanks and bare prefixes', () => {
    const t = (ticketNo: string) => ({ ticketNo })
    expect(duplicateNumbers([t('CASE-0012'), t('case-0012 '), t('WWCMPL'), t('WWCMPL'), t(''), t(''), t('WWCMPL0001')])).toEqual(['CASE-0012'])
  })
})

