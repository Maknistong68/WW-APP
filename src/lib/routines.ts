import { addDays, addMonths, daysDiff, monthRange } from './dates'
import { DUE_SOON_DAYS } from './due'
import type { Routine, RoutineRepeat } from '../types'

// Routine tasks on Home: when each one is due. Pure, so the rules are tested.
// Weekly repeats on the start date's weekday, monthly on its day of the month
// (the last day in shorter months). Only the latest missed date is ever shown:
// repeats don't pile up.

type Schedule = Pick<Routine, 'repeat' | 'start'>
type State = Schedule & Pick<Routine, 'doneThrough'>

const VALID = /^\d{4}-\d{2}-\d{2}$/
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** The n-th date (0 = start); null for a one-off past its first. */
export function occurrence(r: Schedule, n: number): string | null {
  if (n < 0) return null
  switch (r.repeat) {
    case 'once':
      return n === 0 ? r.start : null
    case 'daily':
      return addDays(r.start, n)
    case 'weekly':
      return addDays(r.start, 7 * n)
    case 'monthly': {
      // from the start's day each time (not chained), so the 31st comes back after February
      const month = addMonths(r.start.slice(0, 7), n)
      const last = monthRange(month).end
      const day = r.start.slice(8, 10)
      return day > last.slice(8, 10) ? last : `${month}-${day}`
    }
  }
}

/** Which occurrence is the latest on or before a date (-1 = none yet). */
function indexOnOrBefore(r: Schedule, date: string): number {
  if (date < r.start) return -1
  switch (r.repeat) {
    case 'once':
      return 0
    case 'daily':
      return daysDiff(r.start, date)
    case 'weekly':
      return Math.floor(daysDiff(r.start, date) / 7)
    case 'monthly': {
      const [ys, ms] = r.start.split('-').map(Number)
      const [yd, md] = date.split('-').map(Number)
      const n = (yd - ys) * 12 + (md - ms)
      return (occurrence(r, n) ?? '') <= date ? n : n - 1
    }
  }
}

/** The latest date on or before `date`, or null. */
export const onOrBefore = (r: Schedule, date: string) => occurrence(r, indexOnOrBefore(r, date))

/** The first date after `date`, or null (a one-off already past). */
export const after = (r: Schedule, date: string) => occurrence(r, indexOnOrBefore(r, date) + 1)

/**
 * The date a task shows for, or null when there's nothing to do.
 * A one-off: its date until ticked off. A repeat: the latest date up to today
 * that isn't ticked off (older missed ones are dropped), else the next one.
 */
export function nextDue(r: State, today: string): string | null {
  if (!VALID.test(r.start)) return null
  if (r.repeat === 'once') return r.doneThrough >= r.start ? null : r.start
  const last = onOrBefore(r, today)
  if (last && last > r.doneThrough) return last
  return after(r, r.doneThrough > today ? r.doneThrough : today)
}

/** Days ahead a task comes up on Home: daily and weekly on their day; monthly and one-offs a week ahead. */
export const LEAD_DAYS: Record<RoutineRepeat, number> = { once: DUE_SOON_DAYS, monthly: DUE_SOON_DAYS, daily: 0, weekly: 0 }

/** Home group: past its date = overdue; within its lead = this week; else later. */
export function routineGroup(repeat: RoutineRepeat, due: string, today: string): 'overdue' | 'week' | 'later' {
  if (due < today) return 'overdue'
  return daysDiff(today, due) <= LEAD_DAYS[repeat] ? 'week' : 'later'
}

/** "Once", "Every day", "Every Monday", "Every month on day 15". */
export function repeatText(r: Schedule): string {
  if (r.repeat === 'once') return 'Once'
  if (r.repeat === 'daily') return 'Every day'
  if (!VALID.test(r.start)) return r.repeat === 'weekly' ? 'Every week' : 'Every month'
  if (r.repeat === 'weekly') {
    const [y, m, d] = r.start.split('-').map(Number)
    return `Every ${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}`
  }
  return `Every month on day ${Number(r.start.slice(8, 10))}`
}

/**
 * Where "done up to" starts for a new task or a changed schedule: nothing for
 * a one-off; yesterday for repeats, so a start date in the past never makes
 * the task late on day one (a daily or weekly one due today still shows).
 */
export const freshDoneThrough = (repeat: RoutineRepeat, today: string) => (repeat === 'once' ? '' : addDays(today, -1))
