import type { Ticket } from '../types'
import { isOpen } from './aging'

/** "SAR 12,500" */
export const sar = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : `SAR ${Math.round(v).toLocaleString('en-US')}`

/** Compact for hero tiles: 12.5K, 1.2M */
export function sarShort(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`
  if (v >= 10_000) return `${Math.round(v / 1000)}K`
  return Math.round(v).toLocaleString('en-US')
}

export interface MoneyStats {
  /** Owed on tickets still open. */
  outstanding: number
  /** Owed on tickets that are closed (settled). */
  settled: number
  total: number
  /** Tickets with an amount. */
  withAmount: number
  byKey: (keyOf: (t: Ticket) => string) => { key: string; amount: number; count: number }[]
}

export function moneyStats(tickets: Ticket[]): MoneyStats {
  const priced = tickets.filter((t) => typeof t.amountOwed === 'number' && t.amountOwed > 0)
  const outstanding = priced.filter(isOpen).reduce((s, t) => s + t.amountOwed!, 0)
  const settled = priced.filter((t) => !isOpen(t)).reduce((s, t) => s + t.amountOwed!, 0)
  return {
    outstanding,
    settled,
    total: outstanding + settled,
    withAmount: priced.length,
    byKey: (keyOf) => {
      const m = new Map<string, { key: string; amount: number; count: number }>()
      for (const t of priced) {
        const k = keyOf(t) || '—'
        const e = m.get(k) ?? { key: k, amount: 0, count: 0 }
        e.amount += t.amountOwed!
        e.count++
        m.set(k, e)
      }
      return [...m.values()].sort((a, b) => b.amount - a.amount)
    },
  }
}
