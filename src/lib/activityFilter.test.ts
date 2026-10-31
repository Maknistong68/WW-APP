import { describe, expect, it } from 'vitest'
import { filterActivity } from './activityFilter'
import type { ActivityEntry } from '../types'

const e = (p: Partial<ActivityEntry>): ActivityEntry => ({
  uuid: Math.random().toString(),
  time: '2026-10-30T10:00:00Z',
  entity: 'ticket',
  entityUuid: 'x',
  action: 'add',
  label: 'WWCMPL0001 · RPCO',
  changes: [],
  ...p,
})

describe('activity log filters', () => {
  const now = Date.parse('2026-10-31T12:00:00Z')
  const all = [
    e({}),
    e({ action: 'close', time: '2026-10-01T00:00:00Z' }),
    e({ entity: 'workOrder', label: 'Al Fahad · WO 882' }),
    e({ entity: 'manpower', action: 'edit' }),
  ]
  it('filters by type, action, period and text', () => {
    const f = (x: Partial<Parameters<typeof filterActivity>[1]>) =>
      filterActivity(all, { entity: 'all', action: 'all', period: 'all', query: '', ...x }, now).length
    expect(f({})).toBe(4)
    expect(f({ action: 'close' })).toBe(1)
    expect(f({ period: '7' })).toBe(3)
    expect(f({ entity: 'contractor' })).toBe(1)
    expect(f({ entity: 'kpi' })).toBe(1)
    expect(f({ query: 'wo 882' })).toBe(1)
  })
})
