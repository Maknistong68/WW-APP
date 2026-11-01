import { ageDays, isOpen } from './aging'
import type { CampStatus } from './camps'
import type { CloseoutStatus } from './closeout'
import type { KpiStatus } from './kpi'
import type { IconName } from '../components/Icon'
import type { Ticket } from '../types'

// One meaning for colour everywhere: red = overdue, amber = due soon,
// green = done / on track, grey = no data, blue = neutral to-do.

export type Tone = 'bad' | 'warn' | 'good' | 'none' | 'info'

/** Default icon that goes with each tone (status is never colour alone). */
export const TONE_ICON: Record<Tone, IconName> = {
  bad: 'alert',
  warn: 'clock',
  good: 'check-circle',
  none: 'info',
  info: 'info',
}

/** Open ≤10 days on track, 11–30 due soon, >30 overdue; closed = neutral. */
export function ticketTone(t: Pick<Ticket, 'status' | 'openedAt' | 'closedAt'>, today?: string): Tone {
  if (!isOpen(t)) return 'none'
  const d = ageDays(t, today)
  return d > 30 ? 'bad' : d > 10 ? 'warn' : 'good'
}

export const kpiTone = (s: KpiStatus): Tone => (s === 'none' ? 'none' : s)

export const campTone = (s: CampStatus): Tone => (s === 'ok' ? 'good' : s === 'due' ? 'warn' : 'bad')

export const closeoutTone = (s: CloseoutStatus): Tone =>
  s === 'overdue' ? 'bad' : s === 'due' ? 'warn' : s === 'closed' ? 'good' : 'info'

