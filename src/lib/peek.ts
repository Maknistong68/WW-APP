import { isOpen } from './aging'
import { niceMax } from './chartScale'
import { daysBetween, localDate } from './dates'
import { owedOf, sarShort } from './money'
import { openOn } from './ticketFilter'
import type { Tone } from './tone'
import type { Ticket } from '../types'

// What a long-press pop-up shows about a thing on the Dashboard: up to three
// key numbers, a small trend, and (for tickets) how the open ones split by age.

export interface PeekFact {
  label: string
  value: string | number
  tone?: Tone
}

export interface PeekSpark {
  values: (number | null)[]
  /** What it shows, for screen readers. */
  label: string
  /** Status of the latest point (colours the end dot). */
  tone?: Tone
  /** A dashed target line. */
  guide?: number
  domain?: [number, number]
}

export interface PeekPart {
  label: string
  value: number
  tone: Tone
}

export interface Peek {
  facts: PeekFact[]
  spark?: PeekSpark
  /** A thin split bar with a legend. */
  parts?: PeekPart[]
  /** What the split bar shows ("Open cases by age"); open tickets by age when not given. */
  partsLabel?: string
}

/** The y range for a count series: 0 to a round number above the biggest value. */
export const countDomain = (values: (number | null)[]): [number, number] => [
  0,
  niceMax(Math.max(1, ...values.filter((v): v is number => v !== null))),
]

/** Open tickets on `date`, split 0–10 (on track) / 11–30 (due soon) / over 30 days (overdue). */
export function ageParts(tickets: Ticket[], date = localDate()): PeekPart[] {
  const parts: PeekPart[] = [
    { label: '0–10 days', value: 0, tone: 'good' },
    { label: '11–30 days', value: 0, tone: 'warn' },
    { label: 'Over 30 days', value: 0, tone: 'bad' },
  ]
  for (const t of tickets) {
    if (!openOn(t, date)) continue
    const days = daysBetween(t.openedAt, date)
    parts[days > 30 ? 2 : days > 10 ? 1 : 0].value++
  }
  return parts
}

/** The worst age among open tickets: red when any is late, amber when any is ageing, else green. */
export const partsTone = (parts: PeekPart[]): Tone =>
  parts[2].value ? 'bad' : parts[1].value ? 'warn' : parts[0].value ? 'good' : 'none'

/**
 * A set of tickets in a few numbers: how many, the workers on them and the SAR
 * still owed; how many were opened in each of `months`; the open ones by age.
 */
export function ticketPeek(tickets: Ticket[], months: string[], today = localDate(), noun = 'Tickets'): Peek {
  const workers = tickets.reduce((s, t) => s + (t.workers || 0), 0)
  const owed = tickets.filter(isOpen).reduce((s, t) => s + owedOf(t), 0)
  const perMonth = months.map((m) => tickets.filter((t) => t.openedAt?.startsWith(m)).length)
  const parts = ageParts(tickets, today)
  const open = parts.reduce((s, p) => s + p.value, 0)
  return {
    facts: [
      { label: noun, value: tickets.length },
      { label: 'Workers', value: workers.toLocaleString('en-US') },
      { label: 'SAR owed', value: owed ? sarShort(owed) : '–', tone: owed ? 'bad' : undefined },
    ],
    spark: {
      values: perMonth,
      label: `${noun} opened, last ${months.length} months`,
      tone: partsTone(parts),
      domain: countDomain(perMonth),
    },
    parts: open ? parts : undefined,
    partsLabel: `Open ${noun.toLowerCase()} by age`,
  }
}
