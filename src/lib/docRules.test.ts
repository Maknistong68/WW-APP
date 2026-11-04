import { afterEach, describe, expect, it } from 'vitest'
import { docOn, isDocOn, ruleAt, setDocRules, switchDoc } from './docRules'
import { allSettled, awaitedItems, itemsFor, markAllIn, setDoc, submissionCounts, SUBMISSION_ITEMS } from './submissions'
import { submissionPct } from './kpi'
import { emptyKpi } from './subjects'
import type { DocRule, KpiMonth } from '../types'

const k = (month: string, p: Partial<KpiMonth> = {}): KpiMonth => ({ ...emptyKpi('c1', 'w1', month), ...p })

afterEach(() => setDocRules([]))

describe('Switching a monthly document off (Settings › Monthly documents)', () => {
  it('every document is on until switched off', () => {
    expect(docOn([], 'salaryDecl', '2026-10')).toBe(true)
  })
  it('off counts from its month on; earlier months keep it', () => {
    const r = switchDoc([], 'salaryDecl', true, '2026-10')
    expect(r).toEqual([{ key: 'salaryDecl', off: true, from: '2026-10' }])
    expect([docOn(r, 'salaryDecl', '2026-09'), docOn(r, 'salaryDecl', '2026-10'), docOn(r, 'salaryDecl', '2027-02')]).toEqual([true, false, false])
    expect(docOn(r, 'wps', '2026-10')).toBe(true)
  })
  it('back on from a later month: the months between stay off', () => {
    const r = switchDoc(switchDoc([], 'salaryDecl', true, '2026-10'), 'salaryDecl', false, '2027-01')
    expect([docOn(r, 'salaryDecl', '2026-12'), docOn(r, 'salaryDecl', '2027-01')]).toEqual([false, true])
    expect(ruleAt(r, 'salaryDecl', '2026-12')?.from).toBe('2026-10')
  })
  it('changing your mind in the same month leaves no trace', () => {
    expect(switchDoc(switchDoc([], 'wps', true, '2026-10'), 'wps', false, '2026-10')).toEqual([])
  })
  it('switching to what it already is adds nothing', () => {
    expect(switchDoc([], 'wps', false, '2026-10')).toEqual([])
  })
  it('a new decision replaces any for the same month or after', () => {
    const later: DocRule[] = [{ key: 'wps', off: true, from: '2026-12' }]
    expect(switchDoc(later, 'wps', true, '2026-10')).toEqual([{ key: 'wps', off: true, from: '2026-10' }])
  })
})

describe('Off documents are not asked for or counted in that month', () => {
  it('the list and the counts leave it out from its month; earlier months keep 10', () => {
    setDocRules([{ key: 'salaryDecl', off: true, from: '2026-10' }])
    expect(isDocOn('salaryDecl', '2026-10')).toBe(false)
    expect(itemsFor('2026-10').map((i) => i.key)).not.toContain('salaryDecl')
    expect(itemsFor('2026-10')).toHaveLength(SUBMISSION_ITEMS.length - 1)
    expect(itemsFor('2026-09')).toHaveLength(SUBMISSION_ITEMS.length)
    expect(submissionCounts(k('2026-10'))).toEqual({ in: 0, required: 9, awaited: 9 })
    expect(submissionCounts(k('2026-09'))).toEqual({ in: 0, required: 10, awaited: 10 })
  })
  it('a work order with nothing saved yet uses the month it is asked about', () => {
    setDocRules([{ key: 'salaryDecl', off: true, from: '2026-10' }])
    expect(awaitedItems(undefined, undefined, '2026-10')).toHaveLength(9)
    expect(submissionCounts(undefined, undefined, '2026-10').required).toBe(9)
  })
  it('settled without it; "they sent everything" leaves it alone', () => {
    setDocRules([{ key: 'salaryDecl', off: true, from: '2026-10' }])
    let m = k('2026-10')
    for (const i of itemsFor('2026-10')) m = setDoc(m, i.key, { state: 'in', on: '2026-11-03' })
    expect(allSettled(m)).toBe(true)
    expect(markAllIn(k('2026-10'), '2026-11-03').salaryDecl).toBe(false)
  })
})

describe('The KPI submission score leaves an off declaration out', () => {
  it('WPS off: manpower and salary in is 100', () => {
    const m = k('2026-10', { manpowerDecl: true, salaryDecl: true })
    expect(submissionPct(m)).toBe(50)
    setDocRules([{ key: 'wps', off: true, from: '2026-10' }])
    expect(submissionPct(m)).toBe(100)
    // an earlier month keeps its score
    expect(submissionPct(k('2026-09', { manpowerDecl: true, salaryDecl: true }))).toBe(50)
  })
  it('all three off: no submission score', () => {
    setDocRules(['wps', 'manpowerDecl', 'salaryDecl'].map((key) => ({ key, off: true, from: '2026-10' }) as DocRule))
    expect(submissionPct(k('2026-10'))).toBeNull()
  })
})
