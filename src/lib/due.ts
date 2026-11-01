import { addMonths, daysDiff, monthOf, monthRange } from './dates'

// When a month's items are due. A month's WPS / manpower / salary declarations are
// due the 15th of the next month; its other KPIs by the end of the next month.

/** Declarations are due on this day of the next month. */
export const DECLARATIONS_DUE_DAY = 15
/** "Due soon" (amber) this many days before the due date. */
export const DUE_SOON_DAYS = 7

/** "2026-10" → "2026-11-15" */
export const declarationsDue = (month: string) => `${addMonths(month, 1)}-${DECLARATIONS_DUE_DAY}`

/** "2026-10" → "2026-11-30" */
export const kpisDue = (month: string) => monthRange(addMonths(month, 1)).end

/** The last month that has ended: the one whose items are coming due. */
export const lastEndedMonth = (today: string) => addMonths(monthOf(today), -1)

/** The month to chase for a picked month: the current month isn't due yet, so use last month. */
export const dueMonthFor = (month: string, today: string) => (month === monthOf(today) ? lastEndedMonth(today) : month)

/** Red after the due date, amber in the last week before it, otherwise nothing yet. */
export function dueTone(due: string, today: string): 'bad' | 'warn' | null {
  const left = daysDiff(today, due)
  return left < 0 ? 'bad' : left <= DUE_SOON_DAYS ? 'warn' : null
}
