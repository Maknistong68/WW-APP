import { describe, expect, it } from 'vitest'
import { WORDS, closedWithin, dashSource, openTrend, ticketsOf } from './dashSource'
import { MONTH, TODAY, fixture } from './dashFixture'

describe('Dashboard: D&C Tickets | Cases | All', () => {
  it('the tab comes from the link; old links (none) stay on D&C tickets', () => {
    expect(dashSource(null)).toBe('tickets')
    expect(dashSource('internal')).toBe('internal')
    expect(dashSource('cases')).toBe('internal')
    expect(dashSource('all')).toBe('all')
    expect(dashSource('other')).toBe('tickets')
  })
  it('each tab counts its own list; All is both', () => {
    const d = fixture()
    expect([ticketsOf(d, 'tickets').length, ticketsOf(d, 'internal').length, ticketsOf(d, 'all').length]).toEqual([5, 2, 7])
  })
  it('the wording follows the tab', () => {
    expect([WORDS.tickets.many, WORDS.internal.many, WORDS.all.many]).toEqual(['tickets', 'cases', 'tickets and cases'])
    expect(WORDS.internal.label).toBe('cases')
    expect(WORDS.tickets.label).toBe('D&C tickets')
  })
})

describe('Open per week', () => {
  it('cases: worked out from their dates, 13 weeks to today', () => {
    const pts = openTrend(fixture(), 'internal', TODAY)
    expect(pts).toHaveLength(13)
    expect(pts[pts.length - 1]).toMatchObject({ date: TODAY, open: 1 })
  })
  it('all: the D&C points plus the cases open on each date', () => {
    const d = fixture()
    const dnc = openTrend(d, 'tickets', TODAY)
    const all = openTrend(d, 'all', TODAY)
    const cases = openTrend(d, 'internal', TODAY)
    expect(all.map((p) => p.date)).toEqual(dnc.map((p) => p.date))
    expect(all[all.length - 1].open).toBe(dnc[dnc.length - 1].open + cases[cases.length - 1].open)
  })
})

describe('Closed within 30 days (cases and All have no Closure KPI)', () => {
  it('of those closed in the month, how many took 30 days or less', () => {
    const d = fixture()
    expect(closedWithin(d.cases, MONTH)).toEqual({ closed: 1, fast: 1, pct: 100 })
    expect(closedWithin(d.tickets, MONTH)).toEqual({ closed: 2, fast: 1, pct: 50 })
    expect(closedWithin(d.tickets, '2026-06')).toEqual({ closed: 0, fast: 0, pct: null })
  })
})
