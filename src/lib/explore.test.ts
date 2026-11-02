import { describe, expect, it } from 'vitest'
import { EXPLORE_CHIPS, countsText, exploreChip, exploreData } from './explore'
import { fixture, MONTH, TODAY } from './dashFixture'

const opts = { month: MONTH, kpiMonth: MONTH, today: TODAY, from: '/dashboard' }

describe('exploreChip', () => {
  it('falls back to the first chip of the view', () => {
    expect(exploreChip('tickets', null)).toBe('contractor')
    expect(exploreChip('tickets', 'largest')).toBe('largest')
    expect(exploreChip('kpis', 'largest')).toBe('each')
    expect(EXPLORE_CHIPS.accommodation[0].key).toBe('inspect')
  })
  it('writes the status counts without zeros', () => {
    expect(countsText({ avg: 80, good: 3, warn: 0, bad: 1, none: 9 })).toBe('3 on track · 1 critical · 9 no data')
    expect(countsText({ avg: null, good: 0, warn: 0, bad: 0, none: 0 })).toBe('—')
  })
})

describe('exploreData · tickets', () => {
  it('by contractor: the month’s opened tickets, biggest first, each with its list and pop-up', () => {
    const x = exploreData(fixture(), 'tickets', 'contractor', opts)
    expect(x.kind).toBe('bars')
    expect(x.items.map((i) => [i.label, i.value, i.detail])).toEqual([
      ['RPCO', 2, '5 workers'],
      ['Al Fahad', 1, '10 workers'],
    ])
    expect(x.items[1].to).toContain('c=ca')
    expect(x.items[1].to).toContain('m=2026-10')
    const hold = x.items[1].hold
    expect(hold?.kind).toBe('peek')
    if (hold?.kind === 'peek') {
      expect(hold.peek.facts[0].value).toBe(1)
      expect(hold.actions.map((a) => a.label)).toEqual(['Open tickets', 'Open contractor', 'See trends'])
    }
    expect(x.sub).toBe('Opened in Oct 2026 · 3 tickets · 15 workers')
  })
  it('by issue, category and source carry their filter', () => {
    const issue = exploreData(fixture(), 'tickets', 'issue', opts)
    expect(issue.items.map((i) => [i.label, i.value])).toEqual([
      ['Salary delay', 2],
      ['Food', 1],
    ])
    expect(issue.items[0].to).toContain('issue=Salary+delay')
    expect(exploreData(fixture(), 'tickets', 'category', opts).items[0].to).toContain('cat=Pay')
    const source = exploreData(fixture(), 'tickets', 'source', opts)
    expect(source.items.map((i) => [i.label, i.value])).toEqual([
      ['D&C tickets', 3],
      ['Cases', 1],
    ])
    expect(source.items[1].to).toContain('src=Internal')
  })
  it('by age is about open tickets today, in status colours', () => {
    const x = exploreData(fixture(), 'tickets', 'age', opts)
    expect(x.items.map((i) => [i.label, i.value, i.tone])).toEqual([
      ['0–10 days', 1, 'good'],
      ['11–30 days', 1, 'warn'],
      ['31–60 days', 1, 'bad'],
      ['61–90 days', 0, 'bad'],
      ['Over 90 days', 0, 'bad'],
    ])
    expect(x.items[2].to).toContain('age=31-60')
  })
  it('money by contractor, owed by age and the largest amounts', () => {
    const money = exploreData(fixture(), 'tickets', 'money', opts)
    expect(money.format).toBe('sar')
    expect(money.items.map((i) => [i.label, i.value, i.detail])).toEqual([
      ['Al Fahad', 5000, '1 ticket'],
      ['RPCO', 2000, '1 ticket'],
    ])
    const owed = exploreData(fixture(), 'tickets', 'owed', opts)
    expect(owed.items.map((i) => [i.label, i.value])).toEqual([['11–30 days', 5000]])
    expect(owed.items[0].to).toContain('owed=open')
    const largest = exploreData(fixture(), 'tickets', 'largest', opts)
    expect(largest.kind).toBe('tickets')
    expect(largest.tickets?.map((t) => t.uuid)).toEqual(['t1', 't3'])
  })
  it('all time counts every ticket', () => {
    const x = exploreData(fixture(), 'tickets', 'contractor', { ...opts, month: null })
    expect(x.items.map((i) => [i.label, i.value])).toEqual([
      ['Al Fahad', 3],
      ['RPCO', 2],
    ])
    expect(x.items[0].to).not.toMatch(/[?&]m=/)
  })
})

describe('exploreData · kpis', () => {
  it('each KPI: the overall row then the nine items, with a spark and the KPI page', () => {
    const x = exploreData(fixture(), 'kpis', 'each', opts)
    expect(x.kind).toBe('rows')
    expect(x.items).toHaveLength(10)
    expect(x.items[0].label).toBe('Overall KPI')
    expect(x.items[1].key).toBe('submission')
    expect(x.items[1].text).toBe('75%')
    expect(x.items[1].to).toBe('/kpis/submission?m=2026-10')
    expect(x.items.find((i) => i.key === 'grievance')?.tag).toBe('auto')
    const hold = x.items[1].hold
    if (hold?.kind === 'peek') {
      expect(hold.peek.spark?.values).toHaveLength(6)
      expect(hold.actions[1].to).toBe('/compare?k=submission')
    } else throw new Error('expected a peek')
  })
  it('by contractor is worst first with the contractor pop-up on hold', () => {
    const x = exploreData(fixture(), 'kpis', 'contractor', opts)
    expect(x.format).toBe('pct')
    expect(x.items).toHaveLength(2)
    expect(x.items[0].value).toBeLessThanOrEqual(x.items[1].value)
    expect(x.items[0].hold).toEqual({ kind: 'contractor', uuid: x.items[0].key })
  })
  it('workers per contractor, quarterly audits and the compare grid', () => {
    const w = exploreData(fixture(), 'kpis', 'workers', opts)
    expect(w.items.map((i) => [i.label, i.value, i.detail])).toEqual([
      ['Al Fahad', 100, '2 illegal'],
      ['RPCO', 50, '0 illegal'],
    ])
    const q = exploreData(fixture(), 'kpis', 'quarterly', opts)
    expect(q.items).toHaveLength(1)
    expect(q.items[0].value).toBe(85)
    expect(q.items[0].detail).toBe('At risk · 1 of 2 audited')
    const hold = q.items[0].hold
    if (hold?.kind === 'peek') expect(hold.peek.facts[2].value).toBe('2 of 4')
    else throw new Error('expected a peek')
    const c = exploreData(fixture(), 'kpis', 'compare', opts)
    expect(c.kind).toBe('grid')
    expect(c.grid?.months).toHaveLength(6)
    expect(c.grid?.rows.length).toBeGreaterThan(0)
  })
})

describe('exploreData · accommodation', () => {
  it('to inspect: expired and due camps, worst first, with the camp pop-up', () => {
    const x = exploreData(fixture(), 'accommodation', 'inspect', opts)
    expect(x.kind).toBe('rows')
    expect(x.items.map((i) => [i.label, i.detail, i.tone])).toEqual([['Camp 2', 'Expired · last 124d ago', 'bad']])
    expect(x.items[0].hold).toEqual({ kind: 'camp', uuid: 'c2' })
  })
  it('scores by camp, lowest first, and camps by contractor', () => {
    const s = exploreData(fixture(), 'accommodation', 'scores', opts)
    expect(s.items.map((i) => [i.label, i.value])).toEqual([
      ['Camp 2', 70],
      ['Camp 1', 86],
    ])
    const c = exploreData(fixture(), 'accommodation', 'contractor', opts)
    expect(c.items.map((i) => [i.label, i.value, i.detail])).toEqual([
      ['RPCO', 1, '1 to inspect'],
      ['Al Fahad', 1, 'all up to date'],
    ])
  })
})
