import { dayMonth, monthLabel } from './dates'
import { isDocOn } from './docRules'
import { setDecl } from './kpi'
import type { DeclField, DocEntry, DocRule, KpiMonth, SubmissionKey } from '../types'

// ---------------------------------------------------------------------------
// The documents each work order's contractor hands in every month: the owner's
// 8 (the Manpower register is also the full manpower declaration), plus the WPS
// certificate and the Salary declaration. Each one is in (with
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
  { key: 'manpowerDecl', label: 'Manpower register', short: 'Manpower', group: 'Registers & declarations', detail: 'Full manpower declaration, including the full subcontractor chain' },
  { key: 'subconDecl', label: 'Subcontractor declaration', short: 'Subcon', group: 'Registers & declarations' },
  { key: 'committeeMinutes', label: 'Committee minutes', short: 'Minutes', group: 'Committee', detail: 'Worker Welfare Committee meeting minutes' },
  { key: 'pestControl', label: 'Pest control records', short: 'Pest control', group: 'Accommodation', detail: 'Dining and mess areas' },
  { key: 'activitySchedule', label: 'Activity schedule', short: 'Activities', group: 'Accommodation', detail: 'Social and sporting activities, group accommodation' },
  { key: 'waterTest', label: 'Water test certificates', short: 'Water test', group: 'Accommodation', detail: 'Drinking water, apartments and villas' },
  { key: 'wps', label: 'WPS certificate', short: 'WPS', group: 'Registers & declarations' },
  { key: 'salaryDecl', label: 'Salary declaration', short: 'Salary', group: 'Registers & declarations' },
]

export const DOC_GROUPS: DocGroup[] = ['Reports', 'Registers & declarations', 'Committee', 'Accommodation']

/**
 * The documents asked for in a month: the Admin can switch some off from a
 * month on (Settings › Monthly documents, src/lib/docRules.ts). No month: all.
 */
export const itemsFor = (month?: string): SubmissionItem[] => (month ? SUBMISSION_ITEMS.filter((i) => isDocOn(i.key, month)) : SUBMISSION_ITEMS)

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

/** Documents still waiting. `month`: for a work order with nothing saved yet (else the record's own). */
export const awaitedItems = (k: KpiMonth | undefined, prev?: KpiMonth, month = k?.month) =>
  itemsFor(month).filter((i) => docState(k, i.key, prev) === 'awaited')

/** In, required (everything not "not provided"/"not applicable") and still waiting; switched-off documents are left out. */
export function submissionCounts(k: KpiMonth | undefined, prev?: KpiMonth, month = k?.month): { in: number; required: number; awaited: number } {
  const states = itemsFor(month).map((i) => docState(k, i.key, prev))
  return {
    in: states.filter((s) => s === 'in').length,
    required: states.filter((s) => s === 'in' || s === 'awaited').length,
    awaited: states.filter((s) => s === 'awaited').length,
  }
}

/** Every document answered for the month: in, not provided or not applicable. */
export const allSettled = (k: KpiMonth | undefined, prev?: KpiMonth, month = k?.month) => awaitedItems(k, prev, month).length === 0

/** Set one document (null = back to waiting). WPS / Manpower / Salary also set the fields the KPI score reads. */
export function setDoc(k: KpiMonth, key: SubmissionKey, entry: DocEntry | null): KpiMonth {
  const docs = { ...(k.docs ?? {}) }
  if (entry) docs[key] = clean(key, entry)
  else delete docs[key]
  let out: KpiMonth = { ...k, docs }
  if (!Object.keys(docs).length) delete out.docs
  if (isLegacy(key)) out = setDecl(out, key, !entry || entry.state === 'awaited' ? null : entry.state === 'in')
  return out
}

function clean(key: SubmissionKey, e: DocEntry): DocEntry {
  const out: DocEntry = { state: e.state }
  if (e.state === 'in' && e.on) out.on = e.on
  // trimmed when saved (applyDocChanges), so a space can be typed
  if (e.note?.trim()) out.note = e.note
  if (e.variant) out.variant = e.variant
  // WPS / Salary in: whether every subcontractor is on it, and if not, which are missing
  if (SUBCON_DOCS.includes(key) && e.state === 'in' && e.allSubcons !== undefined) {
    out.allSubcons = e.allSubcons
    if (!e.allSubcons && e.missing?.length) out.missing = e.missing
  }
  return out
}

/** The documents checked against the work order's subcontractors (each one must be on them). */
export const SUBCON_DOCS: SubmissionKey[] = ['wps', 'salaryDecl']

/** In without every subcontractor: "2 subcons missing" (or "Not all subcons" when none were named); else null. */
export function subconFlag(e: DocEntry | undefined): string | null {
  if (e?.state !== 'in' || e.allSubcons !== false) return null
  const n = e.missing?.length ?? 0
  return n ? `${n} subcon${n === 1 ? '' : 's'} missing` : 'Not all subcons'
}

/** Is this subcontractor ticked (on the document)? Nothing ticked until the check is started. */
export function subconTicked(e: DocEntry | undefined, name: string): boolean {
  if (e?.allSubcons === true) return true
  if (e?.allSubcons === false) return !(e.missing ?? []).includes(name)
  return false
}

/**
 * Tick or untick one subcontractor on the checklist (`list`: the work order's).
 * The answer: all ticked = all included, else the unticked ones are missing.
 */
export function subconTick(e: DocEntry | undefined, list: string[], name: string): { allSubcons: boolean; missing: string[] } {
  const names = [...list, ...(e?.missing ?? []).filter((m) => !list.includes(m))]
  const ticked = new Set(names.filter((n) => subconTicked(e, n)))
  if (ticked.has(name)) ticked.delete(name)
  else ticked.add(name)
  // a name no longer on the work order's list stays only while it is still unticked
  const missing = names.filter((n) => !ticked.has(n))
  return { allSubcons: missing.length === 0, missing }
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
  change: { state?: DocState; on?: string; note?: string; variant?: DocEntry['variant'] | null; allSubcons?: boolean | null; missing?: string[] },
  prev?: KpiMonth,
  today?: string,
): KpiMonth {
  const cur: DocEntry = k.docs?.[key] ?? { state: docState(k, key, prev) }
  const next: DocEntry = { ...cur, state: change.state ?? cur.state }
  if (change.on !== undefined) next.on = change.on
  if (change.note !== undefined) next.note = change.note
  if (change.variant !== undefined) next.variant = change.variant ?? undefined
  if (change.allSubcons !== undefined) {
    next.allSubcons = change.allSubcons ?? undefined
    if (change.allSubcons !== false) delete next.missing
  }
  if (change.missing !== undefined) next.missing = change.missing
  if (next.state === 'in' && !next.on && today) next.on = today
  if (next.state === 'awaited' && !next.note?.trim()) {
    const carried = docState(setDoc(k, key, null), key, prev) === 'na'
    return setDoc(k, key, carried ? { state: 'awaited' } : null)
  }
  return setDoc(k, key, next)
}

/** "They sent everything": every document still waiting becomes in, on this date (switched-off ones are left alone). */
export function markAllIn(k: KpiMonth, on: string, prev?: KpiMonth): KpiMonth {
  let out = k
  for (const i of itemsFor(k.month)) {
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

/** "Minutes, Water test +3": the first few short names, then how many more. */
export function shortList(items: SubmissionItem[], max = 2): string {
  const names = items.slice(0, max).map((i) => i.short).join(', ')
  return items.length > max ? `${names} +${items.length - max}` : names
}

/** One document in a word or two: "In 2 Nov", "Waiting", "Not provided", "N/A". */
export function docText(k: KpiMonth | undefined, key: SubmissionKey, prev?: KpiMonth): string {
  const st = docState(k, key, prev)
  const on = k?.docs?.[key]?.on
  if (st === 'in') {
    const flag = SUBCON_DOCS.includes(key) ? subconFlag(k?.docs?.[key]) : null
    return [on ? `In ${dayMonth(on)}` : 'In', flag].filter(Boolean).join(' · ')
  }
  return st === 'notProvided' ? 'Not provided' : st === 'na' ? 'N/A' : 'Waiting'
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "WPS is missing: A, B. Salary declaration is missing: C." for WPS / Salary in without every subcontractor. */
function subconLines(k: KpiMonth | undefined): string {
  return SUBCON_DOCS.map((key) => {
    const e = k?.docs?.[key]
    if (!subconFlag(e)) return ''
    const label = key === 'wps' ? 'WPS' : 'Salary declaration'
    return e?.missing?.length ? ` ${label} is missing: ${e.missing.join(', ')}.` : ` ${label} does not cover all subcontractors.`
  }).join('')
}

/** A reminder to send the contractor (WhatsApp, email); `k` adds the subcontractors WPS / Salary are missing. */
export function chaseText(subject: string, month: string, missing: SubmissionItem[], due: string, k?: KpiMonth): string {
  const name = MONTHS[Number(month.slice(5, 7)) - 1] ?? month
  const subs = subconLines(k)
  if (!missing.length) return `${subject} — ${name} documents: all in.${subs} Thank you.`
  return `${subject} — ${name} documents still missing: ${missing.map((i) => i.label).join(', ')}.${subs} Due ${dayMonth(due)}.`
}

const STATE_WORDS: Record<DocState, string> = { in: 'in', notProvided: 'not provided', na: 'not applicable', awaited: 'waiting' }

function entryText(e: DocEntry | undefined): string {
  if (!e) return 'waiting'
  let t = STATE_WORDS[e.state]
  if (e.state === 'in' && e.on) t += ` ${dayMonth(e.on)}`
  if (e.variant) t += ` (${e.variant === 'iap' ? 'IAP' : 'issue log'})`
  if (e.allSubcons === true) t += ' (all subcons)'
  else if (e.allSubcons === false) t += e.missing?.length ? ` (missing ${e.missing.join(', ')})` : ' (not all subcons)'
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

/** History lines for a change to Settings › Monthly documents: "Salary declaration off from Oct 2026". */
export function docRuleChangeText(from: DocRule[] | undefined, to: DocRule[] | undefined): string[] {
  const id = (r: DocRule) => `${r.key}|${r.from}|${r.off}`
  const before = new Set((from ?? []).map(id))
  const after = new Set((to ?? []).map(id))
  const label = (k: SubmissionKey) => SUBMISSION_ITEMS.find((i) => i.key === k)?.label ?? k
  return [
    ...(to ?? []).filter((r) => !before.has(id(r))).map((r) => `${label(r.key)} ${r.off ? 'off' : 'on again'} from ${monthLabel(r.from)}`),
    ...(from ?? []).filter((r) => !after.has(id(r)) && !(to ?? []).some((t) => t.key === r.key && t.from === r.from)).map((r) => `${label(r.key)}: ${monthLabel(r.from)} switch undone`),
  ]
}
