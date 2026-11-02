import { describe, expect, it } from 'vitest'
import { monthTwinKeepsPulled, newer } from './syncRules'

describe('sync rules', () => {
  it('compares instants, not strings', () => {
    expect(newer('2026-11-02T10:00:00.000Z', '2026-11-02T10:00:00+00:00')).toBe(false)
    expect(newer('2026-11-02T10:00:01Z', '2026-11-02T10:00:00+00:00')).toBe(true)
    expect(newer('', '2026-11-02T10:00:00Z')).toBe(false)
  })
  it('two rows for one work order and month: every phone keeps the same one', () => {
    const a = { uuid: 'aaa', updatedAt: '2026-11-02T10:00:00Z' }
    const b = { uuid: 'bbb', updatedAt: '2026-11-02T11:00:00Z' }
    // newer wins, seen from either phone
    expect(monthTwinKeepsPulled(b, a)).toBe(true)
    expect(monthTwinKeepsPulled(a, b)).toBe(false)
    // same time: the lower uuid wins, seen from either phone
    const c = { uuid: 'ccc', updatedAt: a.updatedAt }
    expect(monthTwinKeepsPulled(a, c)).toBe(true)
    expect(monthTwinKeepsPulled(c, a)).toBe(false)
  })
})
