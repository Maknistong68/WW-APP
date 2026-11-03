import { describe, expect, it } from 'vitest'
import {
  SUBMISSION_ITEMS,
  allSettled,
  awaitedItems,
  chaseText,
  docChangeText,
  docState,
  markAllIn,
  setDoc,
  submissionCounts,
  applyDocChanges,
  carryBefore,
  editDoc,
} from './submissions'
import { submissionPct } from './kpi'
import { emptyKpi } from './subjects'
import type { KpiMonth } from '../types'

const oct = (p: Partial<KpiMonth> = {}): KpiMonth => ({ ...emptyKpi('c1', 'w1', '2026-10'), ...p })
const sep = (p: Partial<KpiMonth> = {}): KpiMonth => ({ ...emptyKpi('c1', 'w1', '2026-09'), ...p })

describe('The monthly documents', () => {
  it('your 9 in order, then WPS and Salary', () => {
    expect(SUBMISSION_ITEMS.map((i) => i.key)).toEqual([
      'welfareReport',
      'issueLog',
      'manpowerDecl',
      'subconDecl',
      'committeeMinutes',
      'workforceDecl',
      'pestControl',
      'activitySchedule',
      'waterTest',
      'wps',
      'salaryDecl',
    ])
    expect(SUBMISSION_ITEMS.find((i) => i.key === 'manpowerDecl')?.label).toBe('Manpower register')
  })
})

describe('Where a document stands', () => {
  it('nothing yet: everything waiting', () => {
    expect(awaitedItems(oct()).length).toBe(11)
    expect(submissionCounts(oct())).toEqual({ in: 0, required: 11, awaited: 11 })
  })
  it('WPS, Manpower and Salary read the fields older months already have', () => {
    const k = oct({ wps: true, notProvided: ['salaryDecl'] })
    expect(docState(k, 'wps')).toBe('in')
    expect(docState(k, 'salaryDecl')).toBe('notProvided')
    expect(docState(k, 'manpowerDecl')).toBe('awaited')
  })
  it('"not applicable" last month stays so until changed (no apartments, no water tests)', () => {
    const last = setDoc(sep(), 'waterTest', { state: 'na' })
    expect(docState(oct(), 'waterTest', last)).toBe('na')
    expect(awaitedItems(oct(), last).map((i) => i.key)).not.toContain('waterTest')
    // in again this month: counts as in
    const now = setDoc(oct(), 'waterTest', { state: 'in', on: '2026-11-03' })
    expect(docState(now, 'waterTest', last)).toBe('in')
  })
  it('not provided and not applicable are not chased and not required', () => {
    let k = setDoc(oct(), 'pestControl', { state: 'notProvided' })
    k = setDoc(k, 'activitySchedule', { state: 'na' })
    expect(submissionCounts(k)).toEqual({ in: 0, required: 9, awaited: 9 })
  })
  it('settled = nothing waiting', () => {
    expect(allSettled(undefined)).toBe(false)
    expect(allSettled(markAllIn(oct(), '2026-11-05'))).toBe(true)
  })
})

describe('Saving a document', () => {
  it('keeps the date, the note and, for item 2, which was sent', () => {
    const k = setDoc(oct(), 'issueLog', { state: 'in', on: '2026-11-04', note: 'Via email', variant: 'iap' })
    expect(k.docs?.issueLog).toEqual({ state: 'in', on: '2026-11-04', note: 'Via email', variant: 'iap' })
  })
  it('WPS, Manpower and Salary also set the fields the KPI score reads, so the score works as before', () => {
    let k = setDoc(oct(), 'wps', { state: 'in', on: '2026-11-02' })
    k = setDoc(k, 'manpowerDecl', { state: 'in', on: '2026-11-02' })
    k = setDoc(k, 'salaryDecl', { state: 'notProvided' })
    expect(k.wps).toBe(true)
    expect(k.manpowerDecl).toBe(true)
    expect(k.salaryDecl).toBe(false)
    expect(k.notProvided).toEqual(['salaryDecl'])
    expect(submissionPct(k)).toBe(100)
    // back to waiting clears both
    k = setDoc(k, 'salaryDecl', null)
    expect(k.notProvided).toBeUndefined()
    expect(k.docs?.salaryDecl).toBeUndefined()
  })
  it('N/A on WPS counts like not provided for the score', () => {
    const k = setDoc(oct(), 'wps', { state: 'na' })
    expect(docState(k, 'wps')).toBe('na')
    expect(k.notProvided).toEqual(['wps'])
  })
  it('the new documents never change the KPI score (track only)', () => {
    const k = markAllIn(oct({ wps: true, manpowerDecl: true, salaryDecl: false }), '2026-11-05')
    expect(submissionPct(oct({ wps: true, manpowerDecl: true }))).toBe(50)
    expect(submissionPct(setDoc(oct({ wps: true, manpowerDecl: true }), 'waterTest', { state: 'in', on: '2026-11-05' }))).toBe(50)
    expect(submissionPct(k)).toBe(100)
  })
  it('mark all in keeps what was already answered', () => {
    const k = markAllIn(setDoc(oct(), 'waterTest', { state: 'na' }), '2026-11-05')
    expect(docState(k, 'waterTest')).toBe('na')
    expect(k.docs?.welfareReport).toEqual({ state: 'in', on: '2026-11-05' })
  })
})

describe('Chasing and the log', () => {
  it('a reminder to send by WhatsApp', () => {
    const k = markAllIn(oct(), '2026-11-05')
    const missing = awaitedItems(setDoc(setDoc(k, 'committeeMinutes', null), 'waterTest', null))
    expect(chaseText('Al Fahad · WO 882', '2026-10', missing, '2026-11-15')).toBe(
      'Al Fahad · WO 882 — October documents still missing: Committee minutes, Water test certificates. Due 15 Nov.',
    )
  })
  it('history lines name the document and what changed', () => {
    const before = oct()
    const after = setDoc(setDoc(oct(), 'waterTest', { state: 'in', on: '2026-11-02' }), 'issueLog', { state: 'in', on: '2026-11-02', variant: 'iap' })
    expect(docChangeText(before.docs, after.docs)).toEqual(['Issue log / IAP: waiting → in 2 Nov (IAP)', 'Water test certificates: waiting → in 2 Nov'])
    expect(docChangeText(after.docs, setDoc(after, 'waterTest', { state: 'na' }).docs)).toEqual(['Water test certificates: in 2 Nov → not applicable'])
  })
})

describe('"Not applicable" stays until changed', () => {
  const nov = (p: Partial<KpiMonth> = {}): KpiMonth => ({ ...emptyKpi('c1', 'w1', '2026-11'), ...p })
  it('the last answer before the month counts, even across a month nobody filled in', () => {
    const rows = [setDoc(sep(), 'waterTest', { state: 'na' }), oct({ accommodationPct: 80 })]
    expect(docState(nov(), 'waterTest', carryBefore(rows, '2026-11'))).toBe('na')
  })
  it('an answer after the N/A ends it', () => {
    const rows = [setDoc(sep(), 'waterTest', { state: 'na' }), setDoc(oct(), 'waterTest', { state: 'in', on: '2026-11-03' })]
    expect(docState(nov(), 'waterTest', carryBefore(rows, '2026-11'))).toBe('awaited')
  })
  it('only months before this one count', () => {
    const rows = [setDoc(nov(), 'pestControl', { state: 'na' })]
    expect(carryBefore(rows, '2026-11')).toBeUndefined()
    expect(docState(oct(), 'pestControl', carryBefore(rows, '2026-10'))).toBe('awaited')
  })
  it('WPS marked N/A carries too, "not provided" does not', () => {
    const rows = [setDoc(setDoc(sep(), 'wps', { state: 'na' }), 'salaryDecl', { state: 'notProvided' })]
    const prior = carryBefore(rows, '2026-10')
    expect(docState(oct(), 'wps', prior)).toBe('na')
    expect(docState(oct(), 'salaryDecl', prior)).toBe('awaited')
  })
  it('a month with nothing waiting and nothing saved yet is settled', () => {
    let last = sep()
    for (const i of SUBMISSION_ITEMS) last = setDoc(last, i.key, { state: 'na' })
    expect(allSettled(undefined, carryBefore([last], '2026-10'))).toBe(true)
  })
})

describe('Saving the documents panel over a fresh copy', () => {
  it('only the documents changed in the panel are written; a teammate’s other changes stay', () => {
    const opened = oct()
    const edited = setDoc(opened, 'waterTest', { state: 'in', on: '2026-11-03' })
    const fresh = setDoc(oct({ accommodationPct: 75 }), 'wps', { state: 'in', on: '2026-11-01' })
    const out = applyDocChanges(fresh, opened, edited)
    expect(out.accommodationPct).toBe(75)
    expect(docState(out, 'wps')).toBe('in')
    expect(out.docs?.waterTest).toEqual({ state: 'in', on: '2026-11-03' })
  })
  it('a document set back to waiting is cleared, WPS fields too', () => {
    const opened = setDoc(oct(), 'wps', { state: 'in', on: '2026-11-01' })
    const edited = setDoc(opened, 'wps', null)
    const out = applyDocChanges(opened, opened, edited)
    expect(out.wps).toBe(false)
    expect(out.docs).toBeUndefined()
  })
  it('an older month’s WPS (no date) stays as it is when untouched', () => {
    const opened = oct({ wps: true })
    const edited = setDoc(opened, 'pestControl', { state: 'na' })
    const out = applyDocChanges(opened, opened, edited)
    expect(out.wps).toBe(true)
    expect(out.docs?.wps).toBeUndefined()
  })
})

describe('Editing one document in the panel', () => {
  const lastNa = () => carryBefore([setDoc(sep(), 'waterTest', { state: 'na' })], '2026-10')
  it('In gets today’s date unless one is picked', () => {
    const k = editDoc(oct(), 'committeeMinutes', { state: 'in' }, undefined, '2026-11-02')
    expect(k.docs?.committeeMinutes).toEqual({ state: 'in', on: '2026-11-02' })
    expect(editDoc(k, 'committeeMinutes', { on: '2026-11-01' }).docs?.committeeMinutes?.on).toBe('2026-11-01')
  })
  it('a note or which-was-sent can be added without changing the state', () => {
    let k = editDoc(oct(), 'issueLog', { state: 'in' }, undefined, '2026-11-02')
    k = editDoc(k, 'issueLog', { variant: 'iap' })
    k = editDoc(k, 'issueLog', { note: 'By email' })
    expect(k.docs?.issueLog).toEqual({ state: 'in', on: '2026-11-02', note: 'By email', variant: 'iap' })
    expect(editDoc(k, 'issueLog', { variant: null }).docs?.issueLog?.variant).toBeUndefined()
  })
  it('back to Waiting clears it', () => {
    const k = editDoc(editDoc(oct(), 'pestControl', { state: 'in' }, undefined, '2026-11-02'), 'pestControl', { state: 'awaited' })
    expect(k.docs).toBeUndefined()
    expect(docState(k, 'pestControl')).toBe('awaited')
  })
  it('Waiting over last month’s N/A is kept, so this month is chased again', () => {
    const prev = lastNa()
    expect(docState(oct(), 'waterTest', prev)).toBe('na')
    const k = editDoc(oct(), 'waterTest', { state: 'awaited' }, prev)
    expect(docState(k, 'waterTest', prev)).toBe('awaited')
    // and it ends the N/A for the months after
    expect(docState(sep({ month: '2026-11' }), 'waterTest', carryBefore([setDoc(sep(), 'waterTest', { state: 'na' }), k], '2026-11'))).toBe('awaited')
  })
  it('a note on a waiting document is kept ("asked again 3 Nov")', () => {
    const k = editDoc(oct(), 'waterTest', { note: 'Asked again 3 Nov' })
    expect(docState(k, 'waterTest')).toBe('awaited')
    expect(k.docs?.waterTest?.note).toBe('Asked again 3 Nov')
  })
  it('WPS back to waiting clears the score fields too', () => {
    const k = editDoc(editDoc(oct(), 'wps', { state: 'notProvided' }), 'wps', { state: 'awaited' })
    expect([k.wps, k.notProvided, k.docs]).toEqual([false, undefined, undefined])
  })
})

describe('Typing a note', () => {
  it('keeps spaces while typing; trimmed when saved', () => {
    const typing = editDoc(oct(), 'pestControl', { note: 'Asked ' })
    expect(typing.docs?.pestControl?.note).toBe('Asked ')
    const saved = applyDocChanges(oct(), oct(), editDoc(typing, 'pestControl', { note: ' Asked again ' }))
    expect(saved.docs?.pestControl?.note).toBe('Asked again')
  })
})
