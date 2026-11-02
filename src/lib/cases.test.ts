import { describe, expect, it } from 'vitest'
import { CASE_PREFIX, isCase, nextCaseNo, noun, sourceLabel, splitTickets, validCaseNo } from './cases'
import type { Ticket } from '../types'

const tk = (ticketNo: string, source?: Ticket['source']) => ({ uuid: ticketNo, ticketNo, ...(source ? { source } : {}) }) as Ticket

describe('Cases: the team’s own items, apart from D&C tickets', () => {
  it('a case is stored as source Internal; anything else (or no source) is a D&C ticket', () => {
    expect([isCase(tk('CASE-0001', 'Internal')), isCase(tk('WWCMPL0009640', 'System')), isCase(tk('WWCMPL0001'))]).toEqual([true, false, false])
    const { tickets, cases } = splitTickets([tk('WWCMPL1', 'System'), tk('CASE-0001', 'Internal'), tk('WWCMPL2')])
    expect([tickets.map((t) => t.ticketNo), cases.map((t) => t.ticketNo)]).toEqual([['WWCMPL1', 'WWCMPL2'], ['CASE-0001']])
  })
  it('numbers run on from the highest case number, four digits; D&C numbers are ignored', () => {
    expect(nextCaseNo([])).toBe('CASE-0001')
    expect(nextCaseNo(['WWCMPL0009640', 'CASE-0003', 'CASE-0010', 'case-0007'])).toBe('CASE-0011')
    expect(nextCaseNo(['CASE-9999'])).toBe('CASE-10000')
    // older internal numbers (WWCMPL-INT-0010) count too, so a new case never takes a number they will be renamed to
    expect(nextCaseNo(['WWCMPL-INT-0009', 'WWCMPL-INT-0010', 'WWCMPL0009640'])).toBe('CASE-0011')
  })
  it('a case number is the prefix and digits', () => {
    expect(CASE_PREFIX).toBe('CASE-')
    expect(['CASE-0003', 'CASE-', 'CASE-12A', 'WWCMPL0001'].map(validCaseNo)).toEqual([true, false, false, false])
  })
  it('wording: case / ticket, and the source shown as D&C / Case', () => {
    expect([noun(tk('CASE-0001', 'Internal')), noun(tk('WWCMPL1', 'System'))]).toEqual(['case', 'ticket'])
    expect([sourceLabel('Internal'), sourceLabel('System'), sourceLabel('')]).toEqual(['Case', 'D&C', 'D&C'])
  })
})
