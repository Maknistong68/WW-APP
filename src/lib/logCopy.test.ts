import { describe, expect, it } from 'vitest'
import { logText, mergeLogs } from './logCopy'

const a = { time: '2026-11-02T10:00:00.000Z', event: 'Save failed', detail: 'Task: VersionError: old' }
const b = { time: '2026-11-02T09:00:00.000Z', event: 'Cloud sync completed', detail: 'up 0' }

describe('The log you can copy and send', () => {
  it('merges the database log and the fallback copy, newest first, without doubles', () => {
    expect(mergeLogs([b], [a, { ...b }])).toEqual([a, b])
  })
  it('the fallback copy still shows when the database log is empty or broken', () => {
    expect(mergeLogs(undefined, [a])).toEqual([a])
  })
  it('as plain text with the version line on top', () => {
    expect(logText('Version abc1234 · Browser tab', [a])).toBe(
      'Version abc1234 · Browser tab\n2026-11-02T10:00:00.000Z  Save failed — Task: VersionError: old',
    )
  })
})
