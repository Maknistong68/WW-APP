import { describe, expect, it } from 'vitest'
import { combineTickets, groupOf, memberCounts, suggestMain, uncombine } from './groups'
import { moneyStats } from './money'
import type { Ticket } from '../types'

const tk = (no: string, p: Partial<Ticket> = {}): Ticket =>
  ({
    uuid: no,
    ticketNo: no,
    status: 'Open',
    openedAt: '2026-10-01',
    closedAt: '',
    workers: 1,
    amountOwed: null,
    parentUuid: '',
    contractorAction: '',
    wwAction: '',
    notes: '',
    ...p,
  }) as Ticket

describe('combined tickets', () => {
  const a = tk('A', { workers: 10, amountOwed: 500 })
  const b = tk('B', { workers: 3 })
  const c = tk('C', { workers: 2, openedAt: '2026-10-05' })
  const all = [a, b, c, tk('D')]

  it('suggests the ticket with most workers as main', () => {
    expect(suggestMain([b, c, a]).uuid).toBe('A')
  })

  it('closes together: money on the main only, others point at it', () => {
    const out = combineTickets([a, b, c], all, {
      mainUuid: 'A',
      amount: 20000,
      closedAt: '2026-10-31',
      contractorAction: 'Paid',
      wwAction: '',
      close: true,
    })
    expect(out.map((t) => [t.uuid, t.status, t.closedAt, t.parentUuid, t.amountOwed])).toEqual([
      ['A', 'Closed', '2026-10-31', '', 20000],
      ['B', 'Closed', '2026-10-31', 'A', null],
      ['C', 'Closed', '2026-10-31', 'A', null],
    ])
    expect(out[1].notes).toBe('Combined with A')
    const merged = all.map((t) => out.find((o) => o.uuid === t.uuid) ?? t)
    expect(groupOf(merged[2], merged).main.uuid).toBe('A')
    expect(groupOf(merged[0], merged).workers).toBe(15)
    expect(memberCounts(merged).get('A')).toBe(2)
    expect(moneyStats(merged).total).toBe(20000)
  })

  it('combine only keeps tickets open; whole existing groups move along', () => {
    const grouped = [a, { ...b, parentUuid: 'A' }, c, tk('D')]
    const out = combineTickets([c, grouped[0]], grouped, {
      mainUuid: 'C',
      amount: null,
      closedAt: '',
      contractorAction: '',
      wwAction: '',
      close: false,
    })
    expect(out.map((t) => [t.uuid, t.status, t.parentUuid])).toEqual([
      ['A', 'Open', 'C'],
      ['B', 'Open', 'C'],
      ['C', 'Open', ''],
    ])
    // amount moved to the new main is not kept on the old one
    expect(out.find((t) => t.uuid === 'A')!.amountOwed).toBeNull()
  })

  it('uncombine removes the link and the note', () => {
    const t = uncombine(tk('B', { parentUuid: 'A', notes: 'x · Combined with A' }), 'A')
    expect([t.parentUuid, t.notes]).toEqual(['', 'x'])
  })
})
