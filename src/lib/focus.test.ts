import { describe, expect, it } from 'vitest'
import { focusCards } from './focus'
import { fixture, MONTH, TODAY } from './dashFixture'

const opts = { month: MONTH, kpiMonth: MONTH, today: TODAY, from: '/dashboard' }

describe('focusCards · tickets', () => {
  it('open tickets: a ring split by age at the month end, with the late ones to see', () => {
    const [open] = focusCards(fixture(), 'tickets', opts)
    expect(open.kind).toBe('ring')
    expect(open.value).toBe('3')
    expect(open.parts?.map((p) => p.value)).toEqual([1, 1, 1])
    expect(open.tone).toBe('bad')
    expect(open.link.label).toBe('See the 1 late')
    expect(open.link.to).toContain('in=lateAtEnd')
    expect(open.link.to).toContain('m=2026-10')
    expect(open.peek.facts.map((f) => f.value)).toEqual([2, 3, 36])
    expect(open.peek.actions).toHaveLength(4)
  })
  it('closure: a meter against 90 in KPI colours', () => {
    const [, closure] = focusCards(fixture(), 'tickets', opts)
    expect(closure.kind).toBe('meter')
    // the same as the Closure KPI page: mean(WO 882 33%, RPCO 50%), not 2 of 5 pooled
    expect(closure.value).toBe('42%')
    expect(closure.tone).toBe('bad')
    expect(closure.meter?.pct).toBeCloseTo(41.67, 1)
    expect(closure.meter?.target).toBe(90)
    expect(closure.peek.spark?.guide).toBe(90)
    expect(closure.peek.actions[2].to).toBe('/kpis/closure?m=2026-10')
  })
  it("money: SAR recovered in the month and still owed at its end", () => {
    const [, , money] = focusCards(fixture(), 'tickets', opts)
    expect(money.kind).toBe('split')
    expect(money.value).toBe('SAR 5,000')
    expect(money.tone).toBe('bad')
    // recovered = closed in Oct (t3 2,000 + t5 1,000), the same as Over time; owed = open at the end of Oct
    expect(money.parts?.map((p) => p.value)).toEqual([3000, 5000])
    expect(money.link.to).toContain('owed=open')
    expect(money.peek.facts.map((f) => f.value)).toEqual(['5,000', '3,000', '8,000'])
  })
  it('all time counts every ticket and has no month in its links', () => {
    const [open, , money] = focusCards(fixture(), 'tickets', { ...opts, month: null })
    expect(open.value).toBe('3')
    expect(open.link.to).not.toMatch(/[?&]m=/)
    expect(open.line).toBe('3 tickets open today')
    expect(money.value).toBe('SAR 5,000')
    expect(money.parts?.map((p) => p.value)).toEqual([3000, 5000])
  })
})

describe('focusCards · Cases and All tabs', () => {
  it('D&C stays as it was: open, Closure KPI, money', () => {
    expect(focusCards(fixture(), 'tickets', opts).map((c) => c.key)).toEqual(['open', 'closure', 'money'])
    expect(focusCards(fixture(), 'tickets', { ...opts, src: 'tickets' }).map((c) => c.key)).toEqual(['open', 'closure', 'money'])
  })
  it('cases: their own numbers and words, how many turned into tickets, no Closure KPI', () => {
    const cards = focusCards(fixture(), 'tickets', { ...opts, src: 'internal' })
    expect(cards.map((c) => c.key)).toEqual(['open', 'linked', 'closed30', 'money'])
    const [open, linked, closed30, money] = cards
    expect([open.title, open.value]).toEqual(['Open cases', '1'])
    expect(open.link.to).toContain('tab=internal')
    expect(open.peek.spark?.label).toBe('Open cases, last 12 weeks')
    expect([linked.title, linked.value]).toEqual(['Turned into tickets', '1'])
    expect(linked.parts?.map((p) => p.value)).toEqual([1, 1])
    expect(linked.line).toBe('1 of 2 cases opened in Oct turned into D&C tickets')
    expect(linked.link.to).toContain('link=yes')
    expect(linked.link.to).toContain('tab=internal')
    expect([closed30.value, closed30.meter?.target]).toEqual(['100%', undefined])
    expect(closed30.line).toBe('1 of 1 closed in Oct took 30 days or less')
    expect(money.parts?.map((p) => p.value)).toEqual([500, 0])
    expect(money.peek.sub).toContain('from cases only')
  })
  it('all: tickets and cases together', () => {
    const cards = focusCards(fixture(), 'tickets', { ...opts, src: 'all' })
    expect(cards.map((c) => c.key)).toEqual(['open', 'linked', 'closed30', 'money'])
    expect([cards[0].title, cards[0].value]).toEqual(['Open tickets & cases', '4'])
    expect(cards[0].link.to).toContain('tab=all')
    // the linked card is about cases: its list opens on Cases
    expect(cards[1].link.to).toContain('tab=internal')
  })
})

describe('focusCards · kpis', () => {
  it('four cards: overall ring, submissions meter, audits meter, workers split', () => {
    const cards = focusCards(fixture(), 'kpis', opts)
    expect(cards.map((c) => `${c.key}:${c.kind}`)).toEqual(['overall:ring', 'submissions:meter', 'audits:meter', 'workers:split'])
    const [overall, subs, audits, workers] = cards
    expect(overall.parts?.reduce((s, p) => s + p.value, 0)).toBe(2)
    expect(overall.link.to).toContain('/kpis/overall?m=2026-10')
    expect(subs.value).toBe('1 of 2')
    expect(subs.meter?.pct).toBe(50)
    expect(subs.tone).toBe('info')
    expect(subs.line).toContain('due 15 Nov')
    expect(subs.link.to).toBe('/entry?m=2026-10')
    expect(audits.value).toBe('50%')
    expect(audits.line).toBe('2 findings open · 0 overdue · 4 findings logged')
    expect(audits.peek.facts[2].value).toBe('85%')
    expect(workers.value).toBe('150')
    expect(workers.parts?.map((p) => p.value)).toEqual([148, 2])
    expect(workers.tone).toBe('bad')
    expect(workers.peek.facts.map((f) => f.value)).toEqual([2, 6, 1])
  })
})

describe('focusCards · accommodation', () => {
  it('camps ring and the inspections meter', () => {
    const [camps, insp] = focusCards(fixture(), 'accommodation', opts)
    expect(camps.value).toBe('2')
    expect(camps.parts?.map((p) => p.value)).toEqual([1, 0, 1])
    expect(camps.link).toEqual({ label: 'See the 1 to inspect', to: '/camps?s=expired' })
    expect(insp.value).toBe('86%')
    expect(insp.tone).toBe('warn')
    expect(insp.line).toContain('1 inspection in Oct 2026')
    expect(insp.peek.spark?.values.slice(-2)).toEqual([null, 86])
  })
})
