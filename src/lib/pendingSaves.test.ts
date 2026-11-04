import { beforeEach, describe, expect, it } from 'vitest'
import { addPending, dropPending, readPending, shouldReplay } from './pendingSaves'

// a tiny localStorage for the test runner
const store = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
})

const rec = { uuid: 'm1', updatedAt: '2026-11-04T05:00:00.000Z', totalWorkers: 36 }

describe('A save kept until it is done (so a stuck or interrupted one is never lost)', () => {
  beforeEach(() => store.clear())
  it('is kept while saving and dropped once done', () => {
    const id = addPending({ table: 'manpower', record: rec, label: 'Workers', at: '2026-11-04T05:36:00.000Z' })
    expect(readPending().map((p) => [p.table, p.record.uuid, p.label])).toEqual([['manpower', 'm1', 'Workers']])
    dropPending(id)
    expect(readPending()).toEqual([])
  })
  it('a later save of the same record replaces the earlier one', () => {
    addPending({ table: 'manpower', record: rec, label: 'Workers', at: '2026-11-04T05:36:00.000Z' })
    const later = { ...rec, totalWorkers: 40 }
    addPending({ table: 'manpower', record: later, label: 'Workers', at: '2026-11-04T05:37:00.000Z' })
    expect(readPending().map((p) => (p.record as typeof rec).totalWorkers)).toEqual([40])
  })
  it('saved again after a reload only when nothing newer is stored', () => {
    const p = { id: 'x', table: 'manpower' as const, record: rec, label: 'Workers', at: '2026-11-04T05:36:00.000Z' }
    expect(shouldReplay(p, undefined)).toBe(true)
    expect(shouldReplay(p, { updatedAt: '2026-11-04T05:00:00.000Z' })).toBe(true)
    // saved meanwhile (here, or synced from a teammate): left alone
    expect(shouldReplay(p, { updatedAt: '2026-11-04T05:40:00.000Z' })).toBe(false)
  })
  it('a broken store reads as empty', () => {
    store.set('ww.pendingSaves', '{not json')
    expect(readPending()).toEqual([])
  })
})
