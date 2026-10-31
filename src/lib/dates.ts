const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar date as YYYY-MM-DD. */
export function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** YYYY-MM of a YYYY-MM-DD date (or of today). */
export const monthOf = (date: string = localDate()) => date.slice(0, 7)

const dayNumber = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return Date.UTC(y, (m || 1) - 1, d || 1) / 86400000
}

/** Whole days from a to b (YYYY-MM-DD), never negative. */
export function daysBetween(a: string, b: string): number {
  if (!a || !b) return 0
  return Math.max(0, Math.round(dayNumber(b) - dayNumber(a)))
}

/** Days from a to b (YYYY-MM-DD); negative when b is before a. */
export function daysDiff(a: string, b: string): number {
  return Math.round(dayNumber(b) - dayNumber(a))
}

/** First and last day of a YYYY-MM month. */
export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { start: `${month}-01`, end: `${month}-${pad(last)}` }
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`
}

export function addDays(ymd: string, delta: number): string {
  const d = new Date(dayNumber(ymd) * 86400000 + delta * 86400000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Oct 2026" */
export const monthLabel = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return `${MONTHS[(m || 1) - 1]} ${y}`
}

/** "27 Oct" (adds the year when it differs from this year) */
export function shortDate(ymd: string): string {
  if (!ymd) return ''
  const [y, m, d] = ymd.split('-').map(Number)
  const thisYear = new Date().getFullYear()
  return `${d} ${MONTHS[(m || 1) - 1]}${y !== thisYear ? ` ${y}` : ''}`
}
