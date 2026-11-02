import type { TicketSource } from '../types'

// Cases: the team's own items raised with a contractor (salary not received,
// overtime, no Ajeer…), kept apart from D&C hotline tickets. They share the
// tickets table and are stored with source 'Internal' — older app versions
// turn any other value into a D&C ticket, so the stored value never changes.
// Only D&C tickets count in the KPIs and in every number labelled "tickets".

/** Every case number starts with this, e.g. CASE-0011. */
export const CASE_PREFIX = 'CASE-'

type HasSource = { source?: TicketSource }

export const isCase = (t: HasSource) => t.source === 'Internal'

/** D&C tickets and the team's own cases, apart. No source = D&C (older records). */
export function splitTickets<T extends HasSource>(all: T[]): { tickets: T[]; cases: T[] } {
  const tickets: T[] = []
  const cases: T[] = []
  for (const t of all) (isCase(t) ? cases : tickets).push(t)
  return { tickets, cases }
}

/** A case number, or an older internal one (WWCMPL-INT-0007) that becomes CASE-0007. */
const CASE_NO = /^(?:CASE-|WWCMPL-INT-)(\d+)$/i

/** The next case number: one past the highest one in use (older internal numbers too), at least four digits. */
export function nextCaseNo(numbers: string[]): string {
  let top = 0
  for (const n of numbers) {
    const m = CASE_NO.exec(n.trim())
    if (m) top = Math.max(top, Number(m[1]))
  }
  return `${CASE_PREFIX}${String(top + 1).padStart(4, '0')}`
}

export const validCaseNo = (no: string) => /^CASE-\d+$/.test(no.trim().toUpperCase())

/** "case" or "ticket", for wording that fits the record. */
export const noun = (t: HasSource): 'case' | 'ticket' => (isCase(t) ? 'case' : 'ticket')

/** The source as shown: D&C (hotline) or Case (the team's own). */
export const sourceLabel = (s: TicketSource | string | undefined) => (s === 'Internal' ? 'Case' : 'D&C')
