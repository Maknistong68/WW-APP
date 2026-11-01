import { describe, expect, it } from 'vitest'
import { buildTodo } from './todo'
import type { AllData } from './kpiData'
import type { Camp, Contractor, KpiMonth, Ticket } from '../types'

const base = (p: Partial<AllData> = {}): AllData => {
  const contractors = [{ uuid: 'c', name: 'RPCO', active: true, aliases: [] } as unknown as Contractor]
  return {
    loaded: true,
    contractors,
    byUuid: new Map(contractors.map((c) => [c.uuid, c])),
    workOrders: [],
    woByUuid: new Map(),
    camps: [],
    tickets: [],
    kpis: [],
    manpower: [],
    weekly: [],
    inspections: [],
    ...p,
  }
}
const card = (cards: ReturnType<typeof buildTodo>, key: string) => cards.find((c) => c.key === key)!

describe('To-do home', () => {
  it('in November, submission checks October (due 15 Nov): to do, then amber, then overdue', () => {
    const early = card(buildTodo(base(), '2026-11-01'), 'submission')
    expect([early.todo, early.alert, early.to]).toEqual([1, undefined, '/missing/submission?m=2026-10'])
    expect(early.detail).toContain('Oct 2026')
    expect(card(buildTodo(base(), '2026-11-08'), 'submission').alert).toEqual({ level: 'warn', text: 'Due 15 Nov' })
    expect(card(buildTodo(base(), '2026-11-16'), 'submission').alert).toEqual({ level: 'bad', text: '1 overdue' })
  })
  it('submission is done when October has all three, whatever November has', () => {
    const all3 = { contractorUuid: 'c', workOrderUuid: '', wps: true, manpowerDecl: true, salaryDecl: true }
    const oct = card(buildTodo(base({ kpis: [{ ...all3, month: '2026-10' }] as KpiMonth[] }), '2026-11-16'), 'submission')
    expect([oct.todo, oct.alert]).toEqual([0, undefined])
    const novOnly = card(buildTodo(base({ kpis: [{ ...all3, month: '2026-11' }] as KpiMonth[] }), '2026-11-16'), 'submission')
    expect(novOnly.todo).toBe(1)
  })
  it('monthly KPIs check October and turn amber in the last week of November', () => {
    const early = card(buildTodo(base(), '2026-11-10'), 'onboarding')
    expect([early.todo, early.alert, early.to]).toEqual([1, undefined, '/missing/onboarding?m=2026-10'])
    expect(card(buildTodo(base(), '2026-11-24'), 'onboarding').alert).toEqual({ level: 'warn', text: 'Due 30 Nov' })
    const kpis = [{ contractorUuid: 'c', workOrderUuid: '', month: '2026-10', onboardingPct: 95 }] as KpiMonth[]
    expect(card(buildTodo(base({ kpis }), '2026-11-24'), 'onboarding').todo).toBe(0)
  })
  it('open tickets flag the ones over 30 days', () => {
    const tickets = [
      { status: 'Open', openedAt: '2026-09-01', workers: 4 },
      { status: 'Open', openedAt: '2026-10-20', workers: 1 },
      { status: 'Closed', openedAt: '2026-09-01', closedAt: '2026-09-02', workers: 9 },
    ] as Ticket[]
    const g = card(buildTodo(base({ tickets }), '2026-10-31'), 'grievance')
    expect([g.todo, g.detail, g.alert?.text]).toEqual([2, '2 open · 5 workers', '1 over 30 days'])
  })
  it('camps never inspected count as expired; cards with alerts come first', () => {
    const camps = [{ uuid: 'k', name: 'Camp A', active: true, cycleDays: 90 } as Camp]
    const cards = buildTodo(base({ camps }), '2026-10-31')
    expect(card(cards, 'camps').alert).toEqual({ level: 'bad', text: '1 expired' })
    expect(cards[0].alert?.level).toBe('bad')
    expect(cards[cards.length - 1].todo === 0 || !cards[cards.length - 1].alert).toBe(true)
  })
})
