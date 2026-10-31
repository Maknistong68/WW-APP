import { daysBetween, localDate } from './dates'
import type { Camp, Contractor, Inspection } from '../types'

// Camps are inspected every `cycleDays` (default 90). A camp is "due" in the
// last 14 days of its cycle and "expired" after it.

export const DEFAULT_CYCLE_DAYS = 90
export const DUE_SOON_DAYS = 14

export type CampStatus = 'ok' | 'due' | 'expired' | 'never'

export const CAMP_STATUS_LABEL: Record<CampStatus, string> = {
  ok: 'OK',
  due: 'Due soon',
  expired: 'Expired',
  never: 'Never inspected',
}

/** Lower-case key for a facility name ("Duba Camp 3 " → "duba camp 3"). */
export const facilityKey = (s: string | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim()

/** Inspections done at this camp: linked by campUuid, or unlinked ones at the same facility name. */
export function campInspections(camp: Camp, inspections: Inspection[]): Inspection[] {
  const key = facilityKey(camp.name)
  const loc = facilityKey(camp.location)
  return inspections
    .filter((i) => {
      if (i.campUuid) return i.campUuid === camp.uuid
      const f = facilityKey(i.info?.facilityLocation ?? '')
      return !!f && (f === key || (!!loc && f === loc))
    })
    .sort((a, b) => (b.info?.reviewDate ?? '').localeCompare(a.info?.reviewDate ?? ''))
}

export interface CampState {
  status: CampStatus
  lastDate: string
  daysSince: number | null
  /** Days until expiry (negative = days past). */
  dueIn: number | null
}

export function campState(camp: Camp, inspections: Inspection[], today = localDate()): CampState {
  const last = campInspections(camp, inspections).find((i) => i.info?.reviewDate)?.info.reviewDate ?? ''
  if (!last) return { status: 'never', lastDate: '', daysSince: null, dueIn: null }
  const since = daysBetween(last, today)
  const cycle = camp.cycleDays || DEFAULT_CYCLE_DAYS
  const dueIn = cycle - since
  const status: CampStatus = dueIn < 0 ? 'expired' : dueIn <= DUE_SOON_DAYS ? 'due' : 'ok'
  return { status, lastDate: last, daysSince: since, dueIn }
}

/**
 * Camps to create from audits that no camp covers yet, grouped by facility
 * name (+ contractor). Lets old inspections show up as a camp's log.
 */
export function campsFromAudits(
  inspections: Inspection[],
  camps: Camp[],
  contractors: Contractor[],
  newId: () => string,
  now: string,
): Camp[] {
  const covered = new Set(camps.map((c) => facilityKey(c.name)))
  const out: Camp[] = []
  for (const i of inspections) {
    if (i.campUuid) continue
    const name = (i.info?.facilityLocation ?? '').trim()
    const key = facilityKey(name)
    if (!key || covered.has(key)) continue
    covered.add(key)
    const cname = (i.info?.contractorNames ?? '').toLowerCase()
    const contractor = contractors.find((c) => cname && [c.name, ...c.aliases].some((n) => cname.includes(n.toLowerCase())))
    out.push({
      uuid: newId(),
      updatedAt: now,
      name,
      contractorUuid: contractor?.uuid ?? '',
      workOrderUuid: '',
      location: i.info?.region ?? '',
      cycleDays: DEFAULT_CYCLE_DAYS,
      active: true,
      notes: '',
    })
  }
  return out
}
