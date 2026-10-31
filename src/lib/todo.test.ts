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
  it('submission is "due 15th" before, overdue after, done when all three are in', () => {
    expect(card(buildTodo(base(), '2026-10-10'), 'submission').alert).toEqual({ level: 'warn', text: 'Due 15th' })
    expect(card(buildTodo(base(), '2026-10-16'), 'submission').alert).toEqual({ level: 'bad', text: '1 overdue' })
    const kpis = [{ contractorUuid: 'c', workOrderUuid: '', month: '2026-10', wps: true, manpowerDecl: true, salaryDecl: true }] as KpiMonth[]
    const done = card(buildTodo(base({ kpis }), '2026-10-16'), 'submission')
    expect([done.todo, done.alert]).toEqual([0, undefined])
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
