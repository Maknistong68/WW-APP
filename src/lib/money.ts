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

/** SAR on a ticket; 0 for none, not known, or a broken amount. */
export const owedOf = (t: Pick<Ticket, 'amountOwed'>) =>
  typeof t.amountOwed === 'number' && Number.isFinite(t.amountOwed) && t.amountOwed > 0 ? t.amountOwed : 0

/**
 * A typed amount: "12,500", "SAR 1,200.50", "12." → the number; blank → null;
 * anything that isn't one non-negative number → undefined.
 */
export function parseSar(text: string): number | null | undefined {
  const s = text.replace(/sar/gi, '').replace(/[,\s]/g, '')
  if (s === '') return null
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(s)) return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

/** The amount a ticket closes with: what was typed, or 0 for "Nothing owed". */
export function closingAmount(text: string, none: boolean): { amount: number } | { error: string } {
  const v = parseSar(text)
  if (v === undefined) return { error: 'Check the amount' }
  if (v === null) return none ? { amount: 0 } : { error: 'Add the money paid, or tap Nothing owed' }
  return { amount: v }
}

/** An amount as it shows in a money box: blank for none or broken. */
export const sarInput = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? String(v) : '')

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
