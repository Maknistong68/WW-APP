import type { KpiMonth, Manpower, Ticket } from '../types'

// Bring records written by older app versions (or pulled from the cloud) up
// to the current shape. Never touches updatedAt, so it can't win a sync.

/** A WWCMPL-style number kept under an older field name. */
function legacyNumber(o: Record<string, unknown>): string {
  for (const [k, v] of Object.entries(o)) {
    if (k !== 'ticketNo' && /No$/.test(k) && typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

export function normalizeTicket(raw: Record<string, unknown>): Ticket {
  const t = raw as unknown as Ticket
  return {
    ...t,
    ticketNo: (typeof raw.ticketNo === 'string' && raw.ticketNo) || legacyNumber(raw),
    source: raw.source === 'Internal' ? 'Internal' : 'System',
    workOrderUuid: typeof raw.workOrderUuid === 'string' ? raw.workOrderUuid : '',
    amountOwed: typeof raw.amountOwed === 'number' ? raw.amountOwed : null,
    parentUuid: typeof raw.parentUuid === 'string' ? raw.parentUuid : '',
  }
}

export function normalizeKpi(raw: Record<string, unknown>): KpiMonth {
  return { ...(raw as unknown as KpiMonth), workOrderUuid: typeof raw.workOrderUuid === 'string' ? raw.workOrderUuid : '' }
}

export function normalizeManpower(raw: Record<string, unknown>): Manpower {
  return { ...(raw as unknown as Manpower), workOrderUuid: typeof raw.workOrderUuid === 'string' ? raw.workOrderUuid : '' }
}

/** Normalizer per Dexie table (identity for tables that need none). */
export const NORMALIZE: Record<string, (r: Record<string, unknown>) => unknown> = {
  tickets: normalizeTicket,
  kpiMonths: normalizeKpi,
  manpower: normalizeManpower,
}
