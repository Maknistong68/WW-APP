import { describe, expect, it } from 'vitest'
import { planRecordSync } from './syncPlan'

const T0 = '2026-11-01T10:00:00.000Z'
const T1 = '2026-11-02T10:00:00.000Z'
const T2 = '2026-11-03T10:00:00.000Z'
type Rec = { uuid: string; updatedAt: string; visibility?: string; ownerId?: string }
const rec = (uuid: string, updatedAt: string, p: Partial<Rec> = {}): Rec => ({ uuid, updatedAt, ...p })
const row = (uuid: string, updated_at: string, deleted = false) => ({ uuid, updated_at, deleted })

describe('Syncing a table: what to remove, push and pull', () => {
  it('as before: newer local is pushed, newer server is pulled, deleted on the server is removed', () => {
    const p = planRecordSync({
      local: [rec('a', T2), rec('b', T0), rec('c', T0), rec('new', T1)],
      remote: [row('a', T1), row('b', T1), row('c', T1, true)],
      readOnly: false,
    })
    expect(p.push.map((r) => r.uuid)).toEqual(['a', 'new'])
    expect(p.pull).toEqual(['b'])
    expect(p.remove).toEqual(['c'])
    expect(p.hidden).toEqual([])
  })
  it('a viewer never pushes', () => {
    expect(planRecordSync({ local: [rec('a', T2)], remote: [row('a', T1)], readOnly: true }).push).toEqual([])
  })
})

describe('Tasks someone made private', () => {
  const me = 'u-me'
  const foreign = (r: { visibility?: string; ownerId?: string }) => r.visibility === 'me' && !!r.ownerId && r.ownerId !== me
  it('a task this phone saw on the server, now gone from what I may see, leaves this phone (not pushed back)', () => {
    const p = planRecordSync({ local: [rec('t', T1, { visibility: 'everyone' })], remote: [], readOnly: false, seen: { t: T1 }, foreign })
    expect(p.hidden).toEqual(['t'])
    expect(p.push).toEqual([])
  })
  it('a task made on this phone offline (never on the server) is pushed, not removed', () => {
    const p = planRecordSync({ local: [rec('n', T1)], remote: [], readOnly: false, seen: {}, foreign })
    expect(p.push.map((r) => r.uuid)).toEqual(['n'])
    expect(p.hidden).toEqual([])
  })
  it('a viewer drops it too', () => {
    expect(planRecordSync({ local: [rec('t', T1)], remote: [], readOnly: true, seen: { t: T1 }, foreign }).hidden).toEqual(['t'])
  })
  it('someone else’s private task is never pushed from this phone', () => {
    const p = planRecordSync({ local: [rec('x', T2, { visibility: 'me', ownerId: 'u-other' })], remote: [row('x', T1)], readOnly: false, seen: { x: T1 }, foreign })
    expect(p.push).toEqual([])
  })
  it('on a shared phone, someone else’s private task leaves once it is on the server; their unsent change stays for them', () => {
    const synced = planRecordSync({ local: [rec('x', T1, { visibility: 'me', ownerId: 'u-other' })], remote: [], readOnly: false, seen: { x: T1 }, foreign })
    expect(synced.hidden).toEqual(['x'])
    const unsent = planRecordSync({ local: [rec('x', T2, { visibility: 'me', ownerId: 'u-other' })], remote: [], readOnly: false, seen: { x: T1 }, foreign })
    expect([unsent.hidden, unsent.push]).toEqual([[], []])
  })
  it('remembers what the server showed this time', () => {
    const p = planRecordSync({ local: [], remote: [row('a', T1), row('b', T2, true)], readOnly: false, seen: { old: T0 }, foreign })
    expect(p.seen).toEqual({ a: T1, b: T2 })
  })
})
