import { describe, expect, it } from 'vitest'
import { mineToSend } from './activityPush'
import type { ActivityEntry } from '../types'

const e = (p: Partial<ActivityEntry>): ActivityEntry => ({
  uuid: Math.random().toString(),
  time: '2026-11-02T10:00:00Z',
  entity: 'ticket',
  entityUuid: 't',
  action: 'edit',
  label: 'x',
  changes: [],
  ...p,
})

describe('Which changes a phone sends up', () => {
  it('only the signed-in person’s own unsent changes (and old ones with no name)', () => {
    const list = [e({ by: 'u1' }), e({ by: 'u2' }), e({}), e({ by: 'u1', synced: true })]
    expect(mineToSend(list, 'u1').map((x) => x.by ?? '-')).toEqual(['u1', '-'])
  })
  it('someone else’s changes wait for them to sign in again', () => {
    expect(mineToSend([e({ by: 'u2' })], 'u1')).toEqual([])
  })
})
