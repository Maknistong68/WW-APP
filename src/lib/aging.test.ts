import { describe, expect, it } from 'vitest'
import { ageDays, ageLabel, ageTone, agingBucket } from './aging'
import { addMonths, daysBetween, monthRange } from './dates'

describe('aging', () => {
  it('counts days to today while open and to closedAt once closed', () => {
    expect(ageDays({ openedAt: '2026-10-01', closedAt: '', status: 'Open' }, '2026-10-31')).toBe(30)
    expect(ageDays({ openedAt: '2026-10-01', closedAt: '2026-10-05', status: 'Closed' }, '2026-10-31')).toBe(4)
  })
  it('buckets on the boundaries', () => {
    expect([0, 10, 11, 30, 31, 60, 61, 90, 91].map(agingBucket)).toEqual([
      '0-10', '0-10', '11-30', '11-30', '31-60', '31-60', '61-90', '61-90', '90+',
    ])
    expect([10, 30, 31].map(ageTone)).toEqual(['ok', 'risk', 'late'])
  })
  it('date helpers', () => {
    expect(daysBetween('2026-02-27', '2026-03-01')).toBe(2)
    expect(monthRange('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' })
    expect(addMonths('2026-12', 1)).toBe('2027-01')
  })
})

describe('age on the ticket tile', () => {
  it('days under a week, weeks under 100 days, then months (no years)', () => {
    expect([0, 1, 6].map(ageLabel)).toEqual(['0D', '1D', '6D'])
    expect([7, 13, 14, 29, 30, 60, 99].map(ageLabel)).toEqual(['1W', '1W', '2W', '4W', '4W', '8W', '14W'])
    expect([100, 119, 120, 365, 430].map(ageLabel)).toEqual(['3M', '3M', '4M', '12M', '14M'])
  })
})
