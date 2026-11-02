import { afterEach, describe, expect, it } from 'vitest'
import { displayName, getActor, isAdmin, lastAction, setActor, setRole, whoName } from './actor'
import type { ActivityEntry } from '../types'

const team = [
  { id: 'u1', username: 'ali', full_name: 'Ali Hassan' },
  { id: 'u2', username: 'mona', full_name: null },
]
const entry = (p: Partial<ActivityEntry>): ActivityEntry => ({
  uuid: Math.random().toString(),
  time: '2026-11-02T10:00:00Z',
  entity: 'ticket',
  entityUuid: 't1',
  action: 'edit',
  label: 'WWCMPL0001',
  changes: [],
  ...p,
})

afterEach(() => {
  setActor(null)
  setRole(null)
})

describe('Who did it, as a name', () => {
  it('your own changes say "You"', () => {
    expect(whoName(entry({ by: 'u1', byName: 'Ali Hassan' }), team, 'u1')).toBe('You')
  })
  it('a teammate shows their current name, else their username', () => {
    expect(whoName(entry({ by: 'u1', byName: 'old name' }), team, 'me')).toBe('Ali Hassan')
    expect(whoName(entry({ by: 'u2' }), team, 'me')).toBe('@mona')
  })
  it('someone not in the team list keeps the name stamped on the entry', () => {
    expect(whoName(entry({ by: 'u9', byName: 'nievaoging' }), team, 'me')).toBe('nievaoging')
  })
  it('an old entry with nobody on it shows no name', () => {
    expect(whoName(entry({}), team, 'me')).toBeNull()
  })
  it('a person is named by full name, then username, then nothing', () => {
    expect(displayName({ full_name: 'Ali Hassan', username: 'ali' })).toBe('Ali Hassan')
    expect(displayName({ full_name: '  ', username: 'ali' })).toBe('@ali')
    expect(displayName({ full_name: null, username: null })).toBe('')
  })
})

describe('The signed-in person', () => {
  it('is remembered for stamping new entries', () => {
    expect(getActor()).toBeNull()
    setActor({ id: 'u1', name: 'Ali Hassan', role: 'editor' })
    expect(getActor()).toEqual({ id: 'u1', name: 'Ali Hassan', role: 'editor' })
  })
  it('admin rights follow the role, also on a phone with no cloud account (local mode = admin)', () => {
    expect(isAdmin()).toBe(false)
    setRole('editor')
    expect(isAdmin()).toBe(false)
    setRole('admin')
    expect(isAdmin()).toBe(true)
  })
})

describe('The last time something happened to a record', () => {
  it('the newest entry with that action', () => {
    const list = [
      entry({ action: 'close', time: '2026-10-01T00:00:00Z', by: 'u2' }),
      entry({ action: 'edit', time: '2026-11-01T00:00:00Z' }),
      entry({ action: 'close', time: '2026-10-20T00:00:00Z', by: 'u1' }),
    ]
    expect(lastAction(list, 'close')?.by).toBe('u1')
    expect(lastAction(list, 'reopen')).toBeUndefined()
  })
})
