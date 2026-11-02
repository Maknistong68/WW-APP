import { describe, expect, it } from 'vitest'
import { ageParts, countDomain, partsTone, ticketPeek } from './peek'
import { fixture, TODAY } from './dashFixture'

describe('ageParts', () => {
  it('splits the open tickets by age on a date', () => {
    const d = fixture()
    // at the end of October: t1 26 days, t2 41 days, t4 3 days (t3 and t5 are closed)
    expect(ageParts(d.tickets, '2026-10-31').map((p) => p.value)).toEqual([1, 1, 1])
    // today: t1 28, t2 43, t4 5
    expect(ageParts(d.tickets, TODAY).map((p) => p.value)).toEqual([1, 1, 1])
  })
  it('is red when any ticket is late, amber when any is ageing, green otherwise', () => {
    const d = fixture()
    expect(partsTone(ageParts(d.tickets, TODAY))).toBe('bad')
    expect(partsTone(ageParts(d.tickets.filter((t) => t.uuid === 't4'), TODAY))).toBe('good')
    expect(partsTone(ageParts([], TODAY))).toBe('none')
  })
})

describe('ticketPeek', () => {
  it('counts tickets, workers and SAR still owed, and opened per month', () => {
    const d = fixture()
    const mine = d.tickets.filter((t) => t.contractorUuid === 'ca')
    const p = ticketPeek(mine, ['2026-08', '2026-09', '2026-10'], TODAY)
    expect(p.facts.map((f) => f.value)).toEqual([3, '19', '5,000'])
    expect(p.facts[2].tone).toBe('bad')
    expect(p.spark?.values).toEqual([1, 1, 1])
    expect(p.parts?.map((x) => x.value)).toEqual([0, 1, 1])
  })
  it('has no split when nothing is open, and a dash for no money', () => {
    const d = fixture()
    const closed = d.tickets.filter((t) => t.status === 'Closed')
    const p = ticketPeek(closed, ['2026-10'], TODAY)
    expect(p.parts).toBeUndefined()
    expect(p.facts[2].value).toBe('–')
  })
  it('scales the spark to a round top', () => {
    expect(countDomain([1, 3, null])).toEqual([0, 5])
    expect(countDomain([12, 7])).toEqual([0, 20])
  })
})
