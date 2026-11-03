import { describe, expect, it } from 'vitest'
import {
  casesFor,
  closeLinkedCase,
  linkCase,
  linkIndex,
  linkText,
  linkedTicket,
  openLinkedCases,
  pickerTickets,
  ticketFromCase,
  turnedIntoTickets,
  unlinkCase,
} from './caseLinks'
import type { Ticket } from '../types'

const base: Ticket = {
  uuid: '',
  updatedAt: 'x',
  source: 'System',
  ticketNo: '',
  channel: 'Worker Hotline',
  contractorUuid: 'c1',
  workOrderUuid: '',
  subcontractor: '',
  category: 'Employment Practice',
  issue: 'Salary delay',
  priority: 2,
  severity: 'Not Acceptable',
  workers: 1,
  violations: 1,
  amountOwed: null,
  parentUuid: '',
  assignedTo: '',
  status: 'Open',
  openedAt: '2026-10-01',
  closedAt: '',
  contractorAction: '',
  wwAction: '',
  notes: '',
}
const dc = (uuid: string, p: Partial<Ticket> = {}): Ticket => ({ ...base, uuid, ticketNo: `WWCMPL-${uuid}`, ...p })
const kase = (uuid: string, p: Partial<Ticket> = {}): Ticket => ({ ...base, uuid, source: 'Internal', ticketNo: `CASE-000${uuid}`, channel: 'Welfare Internal', ...p })

describe('Linking a case to the D&C ticket it turned into', () => {
  it('a case links to a D&C ticket; the case stays open', () => {
    const c = linkCase(kase('1'), dc('t1'))
    expect(c.linkedTicketUuid).toBe('t1')
    expect(c.status).toBe('Open')
  })
  it('only a case, and only to a D&C ticket', () => {
    expect(() => linkCase(dc('t2'), dc('t1'))).toThrow()
    expect(() => linkCase(kase('1'), kase('2'))).toThrow()
  })
  it('unlinking leaves no empty field behind', () => {
    const c = unlinkCase(linkCase(kase('1'), dc('t1')))
    expect('linkedTicketUuid' in c).toBe(false)
  })
  it('a ticket can come from several cases', () => {
    const all = [dc('t1'), linkCase(kase('1'), dc('t1')), linkCase(kase('2'), dc('t1')), kase('3')]
    expect(casesFor('t1', all).map((c) => c.ticketNo)).toEqual(['CASE-0001', 'CASE-0002'])
    expect(linkIndex(all).get('t1')?.length).toBe(2)
    expect(linkedTicket(all[1], all)?.ticketNo).toBe('WWCMPL-t1')
  })
})

describe('What the rows say', () => {
  const all = [dc('t1'), linkCase(kase('1'), dc('t1')), linkCase(kase('2'), dc('t9')), dc('t3'), linkCase(kase('4'), dc('t3')), linkCase(kase('5'), dc('t3'))]
  const index = linkIndex(all)
  const byUuid = new Map(all.map((t) => [t.uuid, t]))
  it('a case points to its ticket, or says it was removed', () => {
    expect(linkText(all[1], index, byUuid)).toBe('→ WWCMPL-t1')
    expect(linkText(all[2], index, byUuid)).toBe('→ ticket removed')
  })
  it('a ticket names the case it came from, or how many', () => {
    expect(linkText(all[0], index, byUuid)).toBe('From CASE-0001')
    expect(linkText(all[3], index, byUuid)).toBe('From 2 cases')
    expect(linkText(dc('t7'), index, byUuid)).toBe('')
  })
})

describe('Picking the ticket', () => {
  const names = new Map([
    ['c1', 'RPCO'],
    ['c2', 'Al Fahad'],
  ])
  const nameOf = (u: string) => names.get(u) ?? ''
  const all = [
    dc('t1', { contractorUuid: 'c2', openedAt: '2026-10-20' }),
    dc('t2', { contractorUuid: 'c1', openedAt: '2026-09-01' }),
    dc('t3', { contractorUuid: 'c1', openedAt: '2026-10-05' }),
    dc('t4', { contractorUuid: 'c1', status: 'Closed', closedAt: '2026-10-10' }),
    kase('1', { contractorUuid: 'c1' }),
  ]
  it('open D&C tickets only: the same contractor first, newest first', () => {
    expect(pickerTickets(all[4], all, '', nameOf).map((t) => t.uuid)).toEqual(['t3', 't2', 't1'])
  })
  it('typing finds by number or contractor, closed ones too (after the open ones)', () => {
    expect(pickerTickets(all[4], all, 'rpco', nameOf).map((t) => t.uuid)).toEqual(['t3', 't2', 't4'])
    expect(pickerTickets(all[4], all, 'wwcmpl-t1', nameOf).map((t) => t.uuid)).toEqual(['t1'])
  })
})

describe('A new D&C ticket from a case', () => {
  it('takes the contractor, work order, issue and workers; the number is typed', () => {
    const c = kase('4', { contractorUuid: 'c2', workOrderUuid: 'w1', subcontractor: 'ABC', issue: 'Overtime', workers: 6, violations: 2, category: 'Not a category' })
    const t = ticketFromCase(c, dc('new', { ticketNo: 'WWCMPL', category: 'Employment Practice' }))
    expect([t.source, t.ticketNo, t.contractorUuid, t.workOrderUuid, t.subcontractor, t.issue, t.workers, t.violations]).toEqual([
      'System',
      'WWCMPL',
      'c2',
      'w1',
      'ABC',
      'Overtime',
      6,
      2,
    ])
    expect(t.category).toBe('Employment Practice')
    expect(t.notes).toBe('From CASE-0004')
    expect(t.uuid).toBe('new')
  })
})

describe('Closing the ticket: the cases that came from it', () => {
  const all = [dc('t1'), dc('t2'), linkCase(kase('1'), dc('t1')), linkCase(kase('2', { status: 'Closed', closedAt: '2026-10-09' }), dc('t1')), linkCase(kase('3'), dc('t2'))]
  it('only the open ones are offered', () => {
    expect(openLinkedCases(['t1'], all).map((c) => c.ticketNo)).toEqual(['CASE-0001'])
    expect(openLinkedCases(['t1', 't2'], all).map((c) => c.ticketNo)).toEqual(['CASE-0001', 'CASE-0003'])
  })
  it('closing one notes the ticket and never dates it before the case opened', () => {
    const c = closeLinkedCase(kase('1', { openedAt: '2026-10-12', wwAction: 'Called the PM' }), dc('t1'), '2026-10-10')
    expect([c.status, c.closedAt]).toEqual(['Closed', '2026-10-12'])
    expect(c.wwAction).toBe('Called the PM\nClosed with WWCMPL-t1')
    expect(closeLinkedCase(kase('1'), dc('t1'), '2026-11-02').wwAction).toBe('Closed with WWCMPL-t1')
  })
})

describe('How many cases turned into tickets', () => {
  const cases = [
    linkCase(kase('1', { openedAt: '2026-10-03' }), dc('t1')),
    kase('2', { openedAt: '2026-10-20' }),
    linkCase(kase('3', { openedAt: '2026-09-15' }), dc('t2')),
  ]
  it('for a month (by the month they were opened) and for all time', () => {
    expect(turnedIntoTickets(cases, '2026-10')).toEqual({ total: 2, linked: 1, notLinked: 1 })
    expect(turnedIntoTickets(cases, null)).toEqual({ total: 3, linked: 2, notLinked: 1 })
  })
})
