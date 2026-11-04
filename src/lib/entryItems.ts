import { lastEndedMonth } from './due'
import { isDocOn } from './docRules'
import { KPI_AUDIT_FIELDS, MANPOWER_FIELDS, mergeEdited } from './merge'
import { SUBMISSION_ITEMS, applyDocChanges, docState, docText, submissionCounts } from './submissions'
import { SUBJECT_ITEMS, quarterMonths, type SubjectItemKey } from './todo'
import { kpiSubjects, subjectKpi, subjectPrior, type KpiSubject } from './subjects'
import type { AllData } from './kpiData'
import type { KpiMonth, Manpower, SubmissionKey } from '../types'

// ---------------------------------------------------------------------------
// Monthly entry (/entry): every item a work order owes each month, so one item
// can be typed for every work order in one list ("By item"), as well as one
// work order at a time ("By work order", the panels). Each row saves only its
// own item over a fresh copy of the month (src/lib/merge.ts).
// ---------------------------------------------------------------------------

export type EntryKind = 'doc' | 'pct' | 'yesno' | 'workers' | 'quarterly'
export type KpiEntryKey = 'accommodation' | 'onboarding' | 'offboarding' | 'meeting' | 'workers' | 'quarterly'
export type EntryKey = SubmissionKey | KpiEntryKey

export interface EntryItem {
  key: EntryKey
  /** In the list's heading and the save log. */
  label: string
  /** On its chip. */
  short: string
  group: 'Documents' | 'KPIs'
  kind: EntryKind
  table: 'kpiMonths' | 'manpower'
  /** The per-work-order check it shares with Home and the KPI pages (KPIs only). */
  check?: SubjectItemKey
}

const KPI_ITEMS: EntryItem[] = [
  { key: 'accommodation', label: 'Accommodation %', short: 'Accommodation', group: 'KPIs', kind: 'pct', table: 'kpiMonths', check: 'accommodation' },
  { key: 'onboarding', label: 'Onboarding %', short: 'Onboarding', group: 'KPIs', kind: 'pct', table: 'kpiMonths', check: 'onboarding' },
  { key: 'offboarding', label: 'Offboarding %', short: 'Offboarding', group: 'KPIs', kind: 'pct', table: 'kpiMonths', check: 'offboarding' },
  { key: 'meeting', label: 'Meeting attended', short: 'Meeting', group: 'KPIs', kind: 'yesno', table: 'kpiMonths', check: 'meeting' },
  { key: 'workers', label: 'Workers', short: 'Workers', group: 'KPIs', kind: 'workers', table: 'manpower', check: 'formal' },
  { key: 'quarterly', label: 'Quarterly audit', short: 'Quarterly audit', group: 'KPIs', kind: 'quarterly', table: 'kpiMonths', check: 'quarterly' },
]

export const ENTRY_ITEMS: EntryItem[] = [
  ...SUBMISSION_ITEMS.map((i): EntryItem => ({ key: i.key, label: i.label, short: i.short, group: 'Documents', kind: 'doc', table: 'kpiMonths' })),
  ...KPI_ITEMS,
]

/** The five KPIs chased on Home each month (the quarterly audit is per quarter). */
export const MONTHLY_KPIS: EntryItem[] = ['accommodation', 'onboarding', 'offboarding', 'workers', 'meeting'].map((k) => KPI_ITEMS.find((i) => i.key === k)!)

export const entryItem = (key: string): EntryItem | undefined => ENTRY_ITEMS.find((i) => i.key === key)

/** The items asked for in a month: documents the Admin switched off are left out. */
export const entryItemsFor = (month: string): EntryItem[] => ENTRY_ITEMS.filter((i) => i.kind !== 'doc' || isDocOn(i.key as SubmissionKey, month))

/** The fields one KPI item writes (offboarding's older counts and `legacy` go with it). */
const FIELDS: Record<KpiEntryKey, readonly string[]> = {
  accommodation: ['accommodationPct'],
  onboarding: ['onboardingPct'],
  offboarding: ['offboardingPct', 'offboarded', 'offboardTotal', 'legacy'],
  meeting: ['meetingPct'],
  workers: MANPOWER_FIELDS,
  quarterly: KPI_AUDIT_FIELDS,
}

/** Entered for this work order and month (a document: answered; a KPI: as Home counts it). */
export function entryDone(d: AllData, s: KpiSubject, month: string, item: EntryItem): boolean {
  if (item.kind === 'doc') return docState(subjectKpi(s, d.kpis, month), item.key as SubmissionKey, subjectPrior(s, d.kpis, month)) !== 'awaited'
  return SUBJECT_ITEMS[item.check!].done(d, s, month)
}

/** What is entered, in a few words ("In 2 Nov", "90%", "120 workers · 2 illegal"); '' when nothing. */
export function entryValue(d: AllData, s: KpiSubject, month: string, item: EntryItem): string {
  if (item.kind === 'doc') return docText(subjectKpi(s, d.kpis, month), item.key as SubmissionKey, subjectPrior(s, d.kpis, month))
  return SUBJECT_ITEMS[item.check!].value(d, s, month)
}

/** How many work orders still owe this item for the month. */
export const itemLeft = (d: AllData, month: string, item: EntryItem) =>
  kpiSubjects(d.contractors, d.workOrders).filter((s) => !entryDone(d, s, month, item)).length

/** One work order's month at a glance: "Docs 4/10 · KPIs 3/5". */
export function woProgress(d: AllData, s: KpiSubject, month: string): { text: string; done: boolean; pct: number } {
  const c = submissionCounts(subjectKpi(s, d.kpis, month), subjectPrior(s, d.kpis, month), month)
  const kpis = MONTHLY_KPIS.filter((i) => entryDone(d, s, month, i)).length
  const total = c.required + MONTHLY_KPIS.length
  return {
    text: `Docs ${c.in}/${c.required} · KPIs ${kpis}/${MONTHLY_KPIS.length}`,
    done: c.awaited === 0 && kpis === MONTHLY_KPIS.length,
    // how much of the month is entered, for the thin bar under the row
    pct: total ? (c.in + kpis) / total : 1,
  }
}

/** One row's save: only this item, written over the fresh copy (documents through their own rules). */
export function mergeRow(item: EntryItem, fresh: KpiMonth | Manpower, opened: KpiMonth | Manpower, edited: KpiMonth | Manpower): KpiMonth | Manpower {
  if (item.kind === 'doc') return applyDocChanges(fresh as KpiMonth, opened as KpiMonth, edited as KpiMonth)
  const fields = FIELDS[item.key as KpiEntryKey] as readonly (keyof (KpiMonth | Manpower))[]
  return mergeEdited(fresh, opened, edited, fields)
}

/** Did this row's item change (typed back to what it was = no)? */
export const rowChanged = (item: EntryItem, opened: KpiMonth | Manpower, edited: KpiMonth | Manpower) =>
  JSON.stringify(mergeRow(item, opened, opened, edited)) !== JSON.stringify(opened)

/** Why a row can't be saved (null = fine). */
export function entryProblem(item: EntryItem, edited: KpiMonth | Manpower): string | null {
  if (item.kind === 'quarterly') {
    const k = edited as KpiMonth
    if ((k.auditClosed ?? 0) > (k.auditFindings ?? 0)) return 'Closed out can’t be more than the findings'
  }
  if (item.kind === 'workers') {
    const m = edited as Manpower
    if ([m.illegalOrFreelance, m.visaExpiring30d, m.paidRecruitmentFees].some((n) => n > m.totalWorkers)) return 'Counts can’t be more than total workers'
  }
  return null
}

/** The quarter's audit entered in another of its months (the row shows it there instead). */
export function otherQuarterAudit(d: AllData, s: KpiSubject, month: string): { month: string; pct: number } | null {
  if (subjectKpi(s, d.kpis, month)?.quarterlyAuditPct != null) return null
  for (const m of quarterMonths(month)) {
    if (m === month) continue
    const pct = subjectKpi(s, d.kpis, m)?.quarterlyAuditPct
    if (pct != null) return { month: m, pct }
  }
  return null
}

// ---- Links ------------------------------------------------------------------

export type EntryBy = 'wo' | 'item'

/** A link into Monthly entry. */
export function entryLink(o: { by?: EntryBy; item?: EntryKey; m?: string }): string {
  const p = new URLSearchParams()
  if (o.by === 'item') {
    p.set('by', 'item')
    if (o.item) p.set('item', o.item)
  }
  if (o.m) p.set('m', o.m)
  const q = p.toString()
  return q ? `/entry?${q}` : '/entry'
}

/** Where an old "/missing/:item" link goes now. */
export function entryFromMissing(item: string, search: URLSearchParams): string {
  const m = search.get('m') ?? undefined
  if (item === 'submission') {
    const doc = search.get('doc')
    return doc && entryItem(doc)?.kind === 'doc' ? entryLink({ by: 'item', item: doc as EntryKey, m }) : entryLink({ m })
  }
  const key = item === 'formal' ? 'workers' : item
  const found = entryItem(key)
  return found ? entryLink({ by: 'item', item: found.key, m }) : entryLink({ m })
}

/** What a Monthly entry link asks for: the way in, the item and the month (the month that ended last by default). */
export function parseEntry(p: URLSearchParams, today: string): { by: EntryBy; item: EntryKey; month: string } {
  const m = p.get('m')
  const item = entryItem(p.get('item') ?? '')
  return {
    by: p.get('by') === 'item' ? 'item' : 'wo',
    item: item?.key ?? ENTRY_ITEMS[0].key,
    month: m && /^\d{4}-\d{2}$/.test(m) ? m : lastEndedMonth(today),
  }
}
