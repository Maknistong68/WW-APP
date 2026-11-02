import { describe, expect, it } from 'vitest'
import { closingAmount, moneyStats, owedOf, parseSar, sar, sarShort } from './money'
import type { Ticket } from '../types'

const t = (p: Partial<Ticket>) => ({ status: 'Open', amountOwed: null, contractorUuid: 'a', ...p }) as Ticket

describe('money', () => {
  it('splits outstanding vs settled and groups by key', () => {
    const m = moneyStats([
      t({ amountOwed: 1000 }),
      t({ amountOwed: 500, status: 'Closed' }),
      t({ amountOwed: 2500, contractorUuid: 'b' }),
      t({}),
    ])
    expect([m.outstanding, m.settled, m.total, m.withAmount]).toEqual([3500, 500, 4000, 3])
    expect(m.byKey((x) => x.contractorUuid)).toEqual([
      { key: 'b', amount: 2500, count: 1 },
      { key: 'a', amount: 1500, count: 2 },
    ])
  })
  it('formats SAR', () => {
    expect(sar(12500)).toBe('SAR 12,500')
    expect(sar(null)).toBe('—')
    expect([950, 12500, 1250000].map(sarShort)).toEqual(['950', '13K', '1.3M'])
  })
  it('reads typed amounts; junk is refused, blank is null', () => {
    expect(parseSar('')).toBeNull()
    expect(parseSar('  ')).toBeNull()
    expect(parseSar('12,500')).toBe(12500)
    expect(parseSar('SAR 1,200.50')).toBe(1200.5)
    expect(parseSar('0')).toBe(0)
    expect(parseSar('12.')).toBe(12)
    expect(parseSar('1.2.3')).toBeUndefined()
    expect(parseSar('-5')).toBeUndefined()
    expect(parseSar('abc')).toBeUndefined()
  })
  it('closing a ticket needs an amount or Nothing owed (0)', () => {
    expect(closingAmount('', true)).toEqual({ amount: 0 })
    expect(closingAmount('', false)).toEqual({ error: 'Add the money paid, or tap Nothing owed' })
    expect(closingAmount('1.2.3', false)).toEqual({ error: 'Check the amount' })
    expect(closingAmount('5,000', false)).toEqual({ amount: 5000 })
  })
  it('a broken, missing or negative amount counts as 0', () => {
    expect(owedOf({ amountOwed: NaN })).toBe(0)
    expect(owedOf({ amountOwed: null })).toBe(0)
    expect(owedOf({ amountOwed: -1 })).toBe(0)
    expect(owedOf({ amountOwed: 500 })).toBe(500)
  })
})
