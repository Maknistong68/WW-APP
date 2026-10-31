import { newUuid } from '../db'
import type { KpiMonth, Manpower } from '../types'

export function emptyKpi(contractorUuid: string, workOrderUuid: string, month: string): KpiMonth {
  return {
    uuid: newUuid(),
    updatedAt: '',
    contractorUuid,
    workOrderUuid,
    month,
    wps: false,
    manpowerDecl: false,
    salaryDecl: false,
    accommodationPct: null,
    onboardingPct: null,
    offboarded: null,
    offboardTotal: null,
    meetingPct: null,
    quarterlyAuditPct: null,
  }
}

export function emptyManpower(contractorUuid: string, workOrderUuid: string, month: string): Manpower {
  return {
    uuid: newUuid(),
    updatedAt: '',
    contractorUuid,
    workOrderUuid,
    month,
    totalWorkers: 0,
    illegalOrFreelance: 0,
    visaExpiring30d: 0,
    paidRecruitmentFees: 0,
  }
}

/** The column being filled on the bulk screen. */
export type BulkMode = 'docs' | 'accommodation' | 'onboarding' | 'offboarding' | 'meeting' | 'quarterly' | 'manpower'

export const BULK_MODES: { key: BulkMode; label: string }[] = [
  { key: 'docs', label: 'Documents' },
  { key: 'accommodation', label: 'Accommodation %' },
  { key: 'onboarding', label: 'Onboarding %' },
  { key: 'offboarding', label: 'Offboarding' },
  { key: 'meeting', label: 'Meeting %' },
  { key: 'quarterly', label: 'Quarterly audit %' },
  { key: 'manpower', label: 'Manpower' },
]

/** KPI fields each mode edits. */
const KPI_FIELDS: Partial<Record<BulkMode, (keyof KpiMonth)[]>> = {
  docs: ['wps', 'manpowerDecl', 'salaryDecl'],
  accommodation: ['accommodationPct'],
  onboarding: ['onboardingPct'],
  offboarding: ['offboarded', 'offboardTotal'],
  meeting: ['meetingPct'],
  quarterly: ['quarterlyAuditPct'],
}

const isEmpty = (v: unknown) => v === null || v === undefined || v === false

/**
 * Copy last month's values for this mode into a draft, only where the draft
 * is still empty. Returns the new draft, or null when nothing changed.
 */
export function fillKpiFromPrevious(draft: KpiMonth, prev: KpiMonth | undefined, mode: BulkMode): KpiMonth | null {
  const fields = KPI_FIELDS[mode]
  if (!prev || !fields) return null
  let next: KpiMonth | null = null
  for (const f of fields) {
    if (isEmpty(draft[f]) && !isEmpty(prev[f])) next = { ...(next ?? draft), [f]: prev[f] }
  }
  return next
}

export function fillManpowerFromPrevious(draft: Manpower, prev: Manpower | undefined): Manpower | null {
  if (!prev || draft.totalWorkers || !prev.totalWorkers) return null
  return { ...draft, totalWorkers: prev.totalWorkers, illegalOrFreelance: prev.illegalOrFreelance }
}

/** Has anything been entered (so an empty draft isn't saved as a record)? */
export function kpiHasData(k: KpiMonth): boolean {
  return Object.values(KPI_FIELDS)
    .flat()
    .some((f) => !isEmpty(k[f as keyof KpiMonth]))
}

/** "83" → 83, "" → null, clamps percentages to 0–100. */
export function parsePct(v: string): number | null {
  const t = v.replace(/[^\d.]/g, '')
  if (t === '') return null
  return Math.min(100, Number(t))
}

export function parseCount(v: string): number | null {
  const t = v.replace(/[^\d]/g, '')
  return t === '' ? null : Number(t)
}
