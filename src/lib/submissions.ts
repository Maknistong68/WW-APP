import { dayMonth } from './dates'
import { setDecl } from './kpi'
import type { DeclField, DocEntry, KpiMonth, SubmissionKey } from '../types'

// ---------------------------------------------------------------------------
// The documents each work order's contractor hands in every month: the owner's
// 9, plus the WPS certificate and the Salary declaration. Each one is in (with
// the date it came), not provided (they can't give it), not applicable (it
// doesn't apply, e.g. no apartments — this carries on to the next months until
// changed), or still waiting. Tracked only: the KPI score still reads WPS /
// Manpower register / Salary the way it always did (src/lib/kpi.ts submissionPct).
// ---------------------------------------------------------------------------

export type DocGroup = 'Reports' | 'Registers & declarations' | 'Committee' | 'Accommodation'

export interface SubmissionItem {
  key: SubmissionKey
  /** On the sheet and in reminders. */
  label: string
  /** Chips and short lists. */
  short: string
  group: DocGroup
  /** The longer wording of the requirement, under the label. */
  detail?: string
}

export const SUBMISSION_ITEMS: SubmissionItem[] = [
  { key: 'welfareReport', label: 'Welfare report', short: 'Report', group: 'Reports', detail: 'Monthly Worker Welfare Report, contractor and subcontractors' },
  { key: 'issueLog', label: 'Issue log / IAP', short: 'Issue log', group: 'Reports', detail: 'Issue logs or Internal Audit Practices, whichever applies' },
  { key: 'manpowerDecl', label: 'Manpower register', short: 'Manpower', group: 'Registers & declarations' },
  { key: 'subconDecl', label: 'Subcontractor declaration', short: 'Subcon', group: 'Registers & declarations' },
  { key: 'committeeMinutes', label: 'Committee minutes', short: 'Minutes', group: 'Committee', detail: 'Worker Welfare Committee meeting minutes' },
  { key: 'workforceDecl', label: 'Full workforce declaration', short: 'Workforce', group: 'Registers & declarations', detail: 'Including the full subcontractor chain' },
  { key: 'pestControl', label: 'Pest control records', short: 'Pest control', group: 'Accommodation', detail: 'Dining and mess areas' },
  { key: 'activitySchedule', label: 'Activity schedule', short: 'Activities', group: 'Accommodation', detail: 'Social and sporting activities, group accommodation' },
  { key: 'waterTest', label: 'Water test certificates', short: 'Water test', group: 'Accommodation', detail: 'Drinking water, apartments and villas' },
  { key: 'wps', label: 'WPS certificate', short: 'WPS', group: 'Registers & declarations' },
  { key: 'salaryDecl', label: 'Salary declaration', short: 'Salary', group: 'Registers & declarations' },
]

export const DOC_GROUPS: DocGroup[] = ['Reports', 'Registers & declarations', 'Committee', 'Accommodation']

const LEGACY = new Set<SubmissionKey>(['wps', 'manpowerDecl', 'salaryDecl'])
const isLegacy = (k: SubmissionKey): k is DeclField => LEGACY.has(k)

export type DocState = DocEntry['state']

/** Where one document stands this month; "not applicable" before (`prev`) carries on until changed. */
export function docState(k: KpiMonth | undefined, key: SubmissionKey, prev?: KpiMonth): DocState {
  const own = ownState(k, key)
  if (own !== 'awaited') return own
  // Set back to waiting this month: chased again, whatever came before.
  if (k?.docs?.[key]?.state === 'awaited') return 'awaited'
  return prev && ownState(prev, key) === 'na' ? 'na' : 'awaited'
}

function ownState(k: KpiMonth | undefined, key: SubmissionKey): DocState {
  if (!k) return 'awaited'
  const e = k.docs?.[key]
  if (isLegacy(key)) {
    // The fields older months already have (and the KPI score reads) decide.
    if (k[key]) return 'in'
    if (k.notProvided?.includes(key)) return e?.state === 'na' ? 'na' : 'notProvided'
    return 'awaited'
  }
  return e?.state ?? 'awaited'
}

/** What the month itself says about a document (null: nothing, it was never answered). */
function answerOf(k: KpiMonth, key: SubmissionKey): DocState | null {
  if (k.docs?.[key]) return ownState(k, key)
  const own = ownState(k, key)
  return own === 'awaited' ? null : own
}

export const awaitedItems = (k: KpiMonth | undefined, prev?: KpiMonth) => SUBMISSION_ITEMS.filter((i) => docState(k, i.key, prev) === 'awaited')

/** In, required (everything not "not provided"/"not applicable") and still waiting. */
export function submissionCounts(k: KpiMonth | undefined, prev?: KpiMonth): { in: number; required: number; awaited: number } {
  const states = SUBMISSION_ITEMS.map((i) => docState(k, i.key, prev))
  return {
    in: states.filter((s) => s === 'in').length,
    required: states.filter((s) => s === 'in' || s === 'awaited').length,
    awaited: states.filter((s) => s === 'awaited').length,
  }
}

/** Every document answered for the month: in, not provided or not applicable. */
export const allSettled = (k: KpiMonth | undefined, prev?: KpiMonth) => awaitedItems(k, prev).length === 0

/** Set one document (null = back to waiting). WPS / Manpower / Salary also set the fields the KPI score reads. */
export function setDoc(k: KpiMonth, key: SubmissionKey, entry: DocEntry | null): KpiMonth {
  const docs = { ...(k.docs ?? {}) }
  if (entry) docs[key] = clean(entry)
  else delete docs[key]
  let out: KpiMonth = { ...k, docs }
  if (!Object.keys(docs).length) delete out.docs
  if (isLegacy(key)) out = setDecl(out, key, !entry || entry.state === 'awaited' ? null : entry.state === 'in')
  return out
}

function clean(e: DocEntry): DocEntry {
  const out: DocEntry = { state: e.state }
  if (e.state === 'in' && e.on) out.on = e.on
  // trimmed when saved (applyDocChanges), so a space can be typed
  if (e.note?.trim()) out.note = e.note
  if (e.variant) out.variant = e.variant
  return out
}

/**
 * One change made in the documents panel: a state, the date it came, a note,
 * or (item 2) which was sent; null clears the variant. In without a date gets
 * `today`. Waiting with nothing to say leaves no entry, except to end a "not
 * applicable" carried from before.
 */
export function editDoc(
  k: KpiMonth,
  key: SubmissionKey,
  change: { state?: DocState; on?: string; note?: string; variant?: DocEntry['variant'] | null },
  prev?: KpiMonth,
  today?: string,
): KpiMonth {
  const cur: DocEntry = k.docs?.[key] ?? { state: docState(k, key, prev) }
  const next: DocEntry = { ...cur, state: change.state ?? cur.state }
  if (change.on !== undefined) next.on = change.on
  if (change.note !== undefined) next.note = change.note
  if (change.variant !== undefined) next.variant = change.variant ?? undefined
  if (next.state === 'in' && !next.on && today) next.on = today
  if (next.state === 'awaited' && !next.note?.trim()) {
    const carried = docState(setDoc(k, key, null), key, prev) === 'na'
    return setDoc(k, key, carried ? { state: 'awaited' } : null)
  }
  return setDoc(k, key, next)
}

/** "They sent everything": every document still waiting becomes in, on this date. */
export function markAllIn(k: KpiMonth, on: string, prev?: KpiMonth): KpiMonth {
  let out = k
  for (const i of SUBMISSION_ITEMS) {
    if (docState(out, i.key, prev) === 'awaited') out = setDoc(out, i.key, { ...out.docs?.[i.key], state: 'in', on })
    else if (docState(out, i.key) === 'awaited' && docState(out, i.key, prev) === 'na') out = setDoc(out, i.key, { state: 'na' })
  }
  return out
}

/**
 * "Not applicable" stays until changed: for each document, its last answer
 * before `month` (a month nobody answered doesn't end it). Returns a month that
 * stands for that history, to pass as `prev`. `rows`: one work order's months.
 */
export function carryBefore(rows: KpiMonth[], month: string): KpiMonth | undefined {
  const earlier = rows.filter((r) => r.month < month).sort((a, b) => b.month.localeCompare(a.month))
  if (!earlier.length) return undefined
  let out: KpiMonth = { ...earlier[0], wps: false, manpowerDecl: false, salaryDecl: false }
  delete out.docs
  delete out.notProvided
  for (const i of SUBMISSION_ITEMS) {
    const last = earlier.map((r) => answerOf(r, i.key)).find((x) => x !== null)
    if (last === 'na') out = setDoc(out, i.key, { state: 'na' })
  }
  return out
}

/** One document as the month has it (an older month's WPS / Manpower / Salary may have no entry, only the field). */
function entryOf(k: KpiMonth, key: SubmissionKey): DocEntry | null {
  const e = k.docs?.[key]
  if (e) return e
  const own = ownState(k, key)
  return own === 'awaited' ? null : { state: own }
}

/** The documents changed between two copies of a month. */
export const changedDocs = (opened: KpiMonth, edited: KpiMonth): SubmissionKey[] =>
  SUBMISSION_ITEMS.filter((i) => JSON.stringify(entryOf(opened, i.key)) !== JSON.stringify(entryOf(edited, i.key))).map((i) => i.key)

/**
 * The documents panel saves over a fresh copy of the month: only the documents
 * changed in the panel (`opened` → `edited`) are written, so what a teammate
 * or the KPI panel saved meanwhile stays.
 */
export function applyDocChanges(fresh: KpiMonth, opened: KpiMonth, edited: KpiMonth): KpiMonth {
  let out = fresh
  for (const key of changedDocs(opened, edited)) {
    const e = entryOf(edited, key)
    out = setDoc(out, key, e?.note ? { ...e, note: e.note.trim() } : e)
  }
  return out
}

/**
 * The documents part of a month (WPS / Manpower / Salary fields, notProvided,
 * docs) taken from `source`, everything else from `target`. The KPI panel saves
 * with this over a fresh read, so documents saved meanwhile are kept.
 */
export function withDocsOf(target: KpiMonth, source: KpiMonth): KpiMonth {
  const out: KpiMonth = { ...target, wps: source.wps, manpowerDecl: source.manpowerDecl, salaryDecl: source.salaryDecl }
  if (source.notProvided?.length) out.notProvided = [...source.notProvided]
  else delete out.notProvided
  if (source.docs && Object.keys(source.docs).length) out.docs = { ...source.docs }
  else delete out.docs
  return out
}

/** "Minutes, Water test +3": the first few short names, then how many more. */
export function shortList(items: SubmissionItem[], max = 2): string {
  const names = items.slice(0, max).map((i) => i.short).join(', ')
  return items.length > max ? `${names} +${items.length - max}` : names
}

/** One document in a word or two: "In 2 Nov", "Waiting", "Not provided", "N/A". */
export function docText(k: KpiMonth | undefined, key: SubmissionKey, prev?: KpiMonth): string {
  const st = docState(k, key, prev)
  const on = k?.docs?.[key]?.on
  return st === 'in' ? (on ? `In ${dayMonth(on)}` : 'In') : st === 'notProvided' ? 'Not provided' : st === 'na' ? 'N/A' : 'Waiting'
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** A reminder to send the contractor (WhatsApp, email). */
export function chaseText(subject: string, month: string, missing: SubmissionItem[], due: string): string {
  const name = MONTHS[Number(month.slice(5, 7)) - 1] ?? month
  if (!missing.length) return `${subject} — ${name} documents: all in. Thank you.`
  return `${subject} — ${name} documents still missing: ${missing.map((i) => i.label).join(', ')}. Due ${dayMonth(due)}.`
}

const STATE_WORDS: Record<DocState, string> = { in: 'in', notProvided: 'not provided', na: 'not applicable', awaited: 'waiting' }

function entryText(e: DocEntry | undefined): string {
  if (!e) return 'waiting'
  let t = STATE_WORDS[e.state]
  if (e.state === 'in' && e.on) t += ` ${dayMonth(e.on)}`
  if (e.variant) t += ` (${e.variant === 'iap' ? 'IAP' : 'issue log'})`
  return t
}

/** History lines for a change to the documents, one per document that changed. */
export function docChangeText(from: KpiMonth['docs'], to: KpiMonth['docs']): string[] {
  const out: string[] = []
  for (const i of SUBMISSION_ITEMS) {
    const a = from?.[i.key]
    const b = to?.[i.key]
    if (JSON.stringify(a ?? null) === JSON.stringify(b ?? null)) continue
    let line = `${i.label}: ${entryText(a)} → ${entryText(b)}`
    if (b?.note && b.note !== a?.note) line += ` · “${b.note}”`
    out.push(line)
  }
  return out
}
