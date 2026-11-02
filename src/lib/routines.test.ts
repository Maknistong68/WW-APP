import { describe, expect, it } from 'vitest'
import { freshDoneThrough, nextDue, occurrence, repeatText, routineGroup } from './routines'
import type { RoutineRepeat } from '../types'

// Today in these tests: Monday 2 November 2026.
const r = (repeat: RoutineRepeat, start: string, doneThrough = '') => ({ repeat, start, doneThrough })

describe('Routine tasks: when they are due', () => {
  it('monthly on the 31st uses the last day of shorter months', () => {
    const m = r('monthly', '2026-01-31')
    expect([0, 1, 2].map((n) => occurrence(m, n))).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
    expect(occurrence(r('monthly', '2028-01-31'), 1)).toBe('2028-02-29')
  })
  it('once: due on its date until ticked off, even when that is in the future', () => {
    expect(nextDue(r('once', '2026-12-05'), '2026-11-02')).toBe('2026-12-05')
    expect(nextDue(r('once', '2026-10-20'), '2026-11-02')).toBe('2026-10-20')
    expect(nextDue(r('once', '2026-10-20', '2026-10-20'), '2026-11-02')).toBeNull()
  })
  it('daily: today until ticked, then tomorrow', () => {
    expect(nextDue(r('daily', '2026-10-28'), '2026-11-02')).toBe('2026-11-02')
    const ticked = nextDue(r('daily', '2026-10-28', '2026-11-02'), '2026-11-02')
    expect(ticked).toBe('2026-11-03')
    expect(routineGroup('daily', ticked!, '2026-11-02')).toBe('later')
  })
  it('weekly, missed: only the latest one shows, and it is late', () => {
    // every Monday from 26 Oct, done 26 Oct; on Wed 4 Nov the 2 Nov one is 2 days late
    const due = nextDue(r('weekly', '2026-10-26', '2026-10-26'), '2026-11-04')
    expect(due).toBe('2026-11-02')
    expect(routineGroup('weekly', due!, '2026-11-04')).toBe('overdue')
    // missed several weeks: still just the latest
    expect(nextDue(r('weekly', '2026-09-07', '2026-09-07'), '2026-11-04')).toBe('2026-11-02')
  })
  it('ticked off early: the next one after that', () => {
    expect(nextDue(r('weekly', '2026-10-26', '2026-11-09'), '2026-11-04')).toBe('2026-11-16')
  })
  it('daily and weekly come up on their day; monthly and once a week ahead', () => {
    expect(routineGroup('weekly', '2026-11-02', '2026-11-02')).toBe('week')
    expect(routineGroup('weekly', '2026-11-09', '2026-11-02')).toBe('later')
    // monthly on the 15th, done for October
    const due = nextDue(r('monthly', '2026-10-15', '2026-10-15'), '2026-11-02')
    expect(due).toBe('2026-11-15')
    expect(routineGroup('monthly', due!, '2026-11-02')).toBe('later')
    expect(routineGroup('monthly', due!, '2026-11-10')).toBe('week')
    expect(routineGroup('once', '2026-11-09', '2026-11-02')).toBe('week')
  })
  it('a new task starting last Monday is not late from day one', () => {
    const t = r('weekly', '2026-10-26', freshDoneThrough('weekly', '2026-11-04'))
    expect(nextDue(t, '2026-11-04')).toBe('2026-11-09')
    // a daily one starting today is due today
    expect(nextDue(r('daily', '2026-11-02', freshDoneThrough('daily', '2026-11-02')), '2026-11-02')).toBe('2026-11-02')
    expect(freshDoneThrough('once', '2026-11-02')).toBe('')
  })
  it('a broken date never shows', () => {
    expect(nextDue(r('weekly', ''), '2026-11-02')).toBeNull()
    expect(nextDue(r('monthly', 'soon'), '2026-11-02')).toBeNull()
  })
  it('says how often, in words', () => {
    expect(repeatText(r('once', '2026-11-02'))).toBe('Once')
    expect(repeatText(r('daily', '2026-11-02'))).toBe('Every day')
    expect(repeatText(r('weekly', '2026-11-02'))).toBe('Every Monday')
    expect(repeatText(r('monthly', '2026-11-15'))).toBe('Every month on day 15')
  })
})
