import { daysBetween, localDate } from './dates'
import type { Ticket } from '../types'

export const AGING_BUCKETS = ['0-10', '11-30', '31-60', '61-90', '90+'] as const
export type AgingBucket = (typeof AGING_BUCKETS)[number]

/** Days a ticket has been (or was) open. */
export function ageDays(t: Pick<Ticket, 'openedAt' | 'closedAt' | 'status'>, today = localDate()): number {
  const end = t.status === 'Closed' && t.closedAt ? t.closedAt : today
  return daysBetween(t.openedAt, end)
}

export function agingBucket(days: number): AgingBucket {
  if (days <= 10) return '0-10'
  if (days <= 30) return '11-30'
  if (days <= 60) return '31-60'
  if (days <= 90) return '61-90'
  return '90+'
}

/** Chip tone: on track ≤10, at risk ≤30, late beyond. */
export const ageTone = (days: number) => (days <= 10 ? 'ok' : days <= 30 ? 'risk' : 'late')

export const isOpen = (t: Pick<Ticket, 'status'>) => t.status !== 'Closed'
