import { describe, expect, it } from 'vitest'
import { moneyStats, sar, sarShort } from './money'
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
})
