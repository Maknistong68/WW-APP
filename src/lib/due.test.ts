import { describe, expect, it } from 'vitest'
import { declarationsDue, dueMonthFor, dueTone, kpisDue, lastEndedMonth } from './due'

describe('Due dates of a month', () => {
  it('declarations are due the 15th of the next month', () => {
    expect(declarationsDue('2026-10')).toBe('2026-11-15')
    expect(declarationsDue('2026-12')).toBe('2027-01-15')
  })
  it('other KPIs are due the last day of the next month', () => {
    expect(kpisDue('2026-10')).toBe('2026-11-30')
    expect(kpisDue('2027-01')).toBe('2027-02-28')
  })
  it('the month that is coming due is the last one that ended', () => {
    expect(lastEndedMonth('2026-11-01')).toBe('2026-10')
    expect(lastEndedMonth('2027-01-31')).toBe('2026-12')
  })
  it('a picked current month looks at last month; past months stay', () => {
    expect(dueMonthFor('2026-11', '2026-11-01')).toBe('2026-10')
    expect(dueMonthFor('2026-09', '2026-11-01')).toBe('2026-09')
  })
  it('amber within 7 days of the due date, red after it', () => {
    expect(dueTone('2026-11-15', '2026-11-01')).toBeNull()
    expect(dueTone('2026-11-15', '2026-11-07')).toBeNull()
    expect(dueTone('2026-11-15', '2026-11-08')).toBe('warn')
    expect(dueTone('2026-11-15', '2026-11-15')).toBe('warn')
    expect(dueTone('2026-11-15', '2026-11-16')).toBe('bad')
  })
})
