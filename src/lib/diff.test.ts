import { describe, expect, it } from 'vitest'
import { diffRecords } from './diff'

describe('diffRecords', () => {
  it('lists only changed fields and ignores uuid/updatedAt', () => {
    const a = { uuid: '1', updatedAt: 'x', status: 'Open', workers: 3, aliases: ['A'] }
    const b = { uuid: '1', updatedAt: 'y', status: 'Closed', workers: 3, aliases: ['A', 'B'] }
    expect(diffRecords(a, b)).toEqual([
      { field: 'status', from: 'Open', to: 'Closed' },
      { field: 'aliases', from: ['A'], to: ['A', 'B'] },
    ])
  })
  it('new record logs only filled fields', () => {
    expect(diffRecords(undefined, { uuid: '1', issue: 'Final salary', notes: '', tags: [] })).toEqual([
      { field: 'issue', from: null, to: 'Final salary' },
    ])
  })
})
