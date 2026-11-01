import { describe, expect, it } from 'vitest'
import { buildAttention } from './attention'
import type { AllData } from './kpiData'
import type { Contractor } from '../types'

const base = (): AllData => {
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
  }
}
const docs = (month: string, today: string) => buildAttention(base(), month, today).find((a) => a.key === 'docs')

describe('Needs attention: missing declarations', () => {
  it('stays quiet while last month is more than a week from its due date', () => {
    expect(docs('2026-11', '2026-11-01')).toBeUndefined()
  })
  it('in the week before the 15th it reports last month, amber', () => {
    const a = docs('2026-11', '2026-11-08')!
    expect([a.tone, a.to]).toEqual(['warn', '/missing/submission?m=2026-10'])
    expect(a.text).toContain('Oct')
    expect(a.text).toContain('due 15 Nov')
  })
  it('turns red after the 15th of the next month', () => {
    expect(docs('2026-11', '2026-11-16')!.tone).toBe('bad')
    expect(docs('2026-09', '2026-11-01')!.tone).toBe('bad')
  })
})
