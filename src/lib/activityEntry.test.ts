import { afterEach, describe, expect, it } from 'vitest'
import { activityEntry } from './activityEntry'
import { setActor } from './actor'

afterEach(() => setActor(null))

describe('A new activity entry', () => {
  it('carries who made it', () => {
    setActor({ id: 'u1', name: 'Ali Hassan', role: 'editor' })
    const e = activityEntry('ticket', 't1', 'close', 'WWCMPL0001 · RPCO')
    expect(e.by).toBe('u1')
    expect(e.byName).toBe('Ali Hassan')
    expect(e.action).toBe('close')
    expect(e.changes).toEqual([])
    expect(e.uuid).toMatch(/^[0-9a-f-]{36}$/)
  })
  it('without anyone signed in (local mode) it carries no name', () => {
    const e = activityEntry('ticket', 't1', 'add', 'x')
    expect(e.by).toBeUndefined()
    expect(e.byName).toBeUndefined()
  })
})
