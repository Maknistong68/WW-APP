import { describe, expect, it } from 'vitest'
import { activityEntry, entryIsPrivate } from './activityEntry'
import { foreignPrivate } from './activityPush'
import { filterActivity } from './activityFilter'
import { isForeignTask, visibleRoutines } from './routines'
import type { ActivityEntry, Routine } from '../types'

const task = (p: Partial<Routine>): Routine => ({ uuid: 'r', updatedAt: 'x', title: 'Camp walk', repeat: 'weekly', start: '2026-11-01', doneThrough: '', notes: '', ...p })
const entry = (p: Partial<ActivityEntry>): ActivityEntry => ({ uuid: Math.random().toString(36), time: '2026-11-02T10:00:00Z', entity: 'routine', entityUuid: 'r', action: 'edit', label: 'Camp walk', changes: [], ...p })

describe('Tasks: Everyone or Only me', () => {
  it('a task of mine that only I see, and everyone’s tasks, are on my Home; someone else’s private one is not', () => {
    const list = [task({ uuid: 'a' }), task({ uuid: 'b', visibility: 'me', ownerId: 'me' }), task({ uuid: 'c', visibility: 'me', ownerId: 'other' }), task({ uuid: 'd', visibility: 'everyone', ownerId: 'other' })]
    expect(visibleRoutines(list, 'me').map((t) => t.uuid)).toEqual(['a', 'b', 'd'])
    expect(isForeignTask(list[2], 'me')).toBe(true)
    expect(isForeignTask(list[1], 'me')).toBe(false)
  })
  it('a phone-only copy (no one signed in) shows every task', () => {
    expect(visibleRoutines([task({ visibility: 'me', ownerId: 'other' })], '')).toHaveLength(1)
  })
})

describe('Their changes in the activity log', () => {
  it('a private task’s changes are marked private; everything else is not', () => {
    expect(entryIsPrivate('routines', task({ visibility: 'me' }))).toBe(true)
    expect(entryIsPrivate('routines', task({ visibility: 'everyone' }))).toBe(false)
    expect(entryIsPrivate('routines', task({}))).toBe(false)
    expect(entryIsPrivate('tickets', { visibility: 'me' })).toBe(false)
    expect(activityEntry('routine', 'r', 'edit', 'x', [], { private: true }).private).toBe(true)
    expect('private' in activityEntry('routine', 'r', 'edit', 'x')).toBe(false)
  })
  it('someone else’s private entries are not shown, and leave a shared phone once sent', () => {
    const list = [entry({ by: 'me', private: true }), entry({ by: 'other', private: true, synced: true }), entry({ by: 'other', private: true }), entry({ by: 'other' })]
    expect(filterActivity(list, { entity: 'all', action: 'all', period: 'all', query: '', me: 'me' })).toHaveLength(2)
    expect(foreignPrivate(list, 'me').map((e) => e.uuid)).toEqual([list[1].uuid])
    // nobody signed in: nothing is hidden
    expect(filterActivity(list, { entity: 'all', action: 'all', period: 'all', query: '' })).toHaveLength(4)
  })
})
