import { describe, expect, it } from 'vitest'
import { removalInfo, removalProblem } from './removal'

describe('Removing a ticket needs a reason', () => {
  it('a few words at least', () => {
    expect(removalProblem('')).toBe('Say why it is being removed')
    expect(removalProblem('  dup ')).toBe('Say why in a few more words')
    expect(removalProblem('Duplicate of WWCMPL0009617')).toBeNull()
  })
})

describe('Why, who and when a ticket was removed', () => {
  const base = { entity: 'ticket' as const, label: 'x', uuid: 'a' }
  it('the newest removal of that ticket, with its reason', () => {
    const entries = [
      { ...base, uuid: '1', entityUuid: 't1', action: 'delete' as const, time: '2026-10-01T00:00:00Z', changes: [{ field: 'reason', from: null, to: 'Old reason' }], by: 'u2' },
      { ...base, uuid: '2', entityUuid: 't1', action: 'restore' as const, time: '2026-10-02T00:00:00Z', changes: [] },
      { ...base, uuid: '3', entityUuid: 't1', action: 'delete' as const, time: '2026-11-02T08:00:00Z', changes: [{ field: 'reason', from: null, to: 'Duplicate' }], by: 'u1' },
      { ...base, uuid: '4', entityUuid: 't2', action: 'delete' as const, time: '2026-11-03T00:00:00Z', changes: [] },
    ]
    expect(removalInfo(entries, 't1')).toEqual({ reason: 'Duplicate', time: '2026-11-02T08:00:00Z', entry: entries[2] })
    expect(removalInfo(entries, 't2')?.reason).toBe('')
    expect(removalInfo(entries, 't9')).toBeNull()
  })
})
