import { describe, expect, it } from 'vitest'
import { OVER_TIME_CHIPS, overTimeChip, overTimeSeries } from './overTime'
import { fixture, MONTH, TODAY } from './dashFixture'

const at = (s: { data: { date: string; value: number | null }[] }, month: string) => s.data.find((p) => p.date.startsWith(month))?.value

describe('overTimeChip', () => {
  it('falls back to the first chip of the view', () => {
    expect(overTimeChip('tickets', null)).toBe('open')
    expect(overTimeChip('tickets', 'recovered')).toBe('recovered')
    expect(overTimeChip('kpis', 'recovered')).toBe('overall')
    expect(OVER_TIME_CHIPS.accommodation.map((c) => c.key)).toEqual(['inspections', 'score'])
  })
})

describe('overTimeSeries · tickets', () => {
  it('open tickets per week continues to today', () => {
    const s = overTimeSeries(fixture(), 'tickets', 'open', MONTH, TODAY)
    expect(s.mode).toBe('week')
    expect(s.data.length).toBeGreaterThanOrEqual(12)
    expect(s.data[s.data.length - 1].date).toBe(TODAY)
    expect(s.data[s.data.length - 1].value).toBe(3)
  })
  it('opened and closed per month over 12 months, with the month to open', () => {
    const opened = overTimeSeries(fixture(), 'tickets', 'opened', MONTH, TODAY)
    expect(opened.data).toHaveLength(12)
    expect(at(opened, '2026-10')).toBe(3)
    expect(at(opened, '2026-09')).toBe(1)
    expect(opened.open).toBe('opened')
    const closed = overTimeSeries(fixture(), 'tickets', 'closed', MONTH, TODAY)
    expect(at(closed, '2026-10')).toBe(2)
    expect(closed.open).toBe('closed')
  })
  it('recovered is SAR on tickets closed in the month', () => {
    const s = overTimeSeries(fixture(), 'tickets', 'recovered', MONTH, TODAY)
    expect(s.sar).toBe(true)
    expect(at(s, '2026-10')).toBe(3000)
    expect(s.open).toBe('paid')
  })
  it('the Cases and All tabs draw their own lists', () => {
    const cases = overTimeSeries(fixture(), 'tickets', 'open', MONTH, TODAY, 'internal')
    expect(cases.data).toHaveLength(13)
    expect(cases.data[cases.data.length - 1].value).toBe(1)
    expect(cases.sub).toBe('Cases open · per week · 13 weeks')
    expect(at(overTimeSeries(fixture(), 'tickets', 'opened', MONTH, TODAY, 'internal'), '2026-10')).toBe(2)
    expect(at(overTimeSeries(fixture(), 'tickets', 'recovered', MONTH, TODAY, 'internal'), '2026-10')).toBe(500)
    const all = overTimeSeries(fixture(), 'tickets', 'open', MONTH, TODAY, 'all')
    expect(all.data[all.data.length - 1].value).toBe(4)
    expect(at(overTimeSeries(fixture(), 'tickets', 'opened', MONTH, TODAY, 'all'), '2026-10')).toBe(5)
  })
})

describe('overTimeSeries · kpis and accommodation', () => {
  it('overall KPI is a percentage with the 90 / 70 guides', () => {
    const s = overTimeSeries(fixture(), 'kpis', 'overall', MONTH, TODAY)
    expect(s.data).toHaveLength(6)
    expect(s.max).toBe(100)
    expect(s.guides?.map((g) => g.value)).toEqual([90, 70])
    expect(s.status).toBe(true)
    expect(at(s, '2026-10')).not.toBeNull()
  })
  it('workers per month, blank where nobody declared', () => {
    const s = overTimeSeries(fixture(), 'kpis', 'workers', MONTH, TODAY)
    expect(at(s, '2026-10')).toBe(150)
    expect(at(s, '2026-09')).toBe(90)
    expect(at(s, '2026-08')).toBeNull()
  })
  it('documents: the share of work orders with every document in (or not provided / N/A)', () => {
    const s = overTimeSeries(fixture(), 'kpis', 'submissions', MONTH, TODAY)
    expect(at(s, '2026-10')).toBe(50)
    expect(at(s, '2026-09')).toBe(50)
  })
  it('inspections per month and their average score', () => {
    const n = overTimeSeries(fixture(), 'accommodation', 'inspections', MONTH, TODAY)
    expect(at(n, '2026-10')).toBe(1)
    expect(at(n, '2026-07')).toBe(1)
    const score = overTimeSeries(fixture(), 'accommodation', 'score', MONTH, TODAY)
    expect(at(score, '2026-10')).toBe(86)
    expect(at(score, '2026-09')).toBeNull()
  })
})
