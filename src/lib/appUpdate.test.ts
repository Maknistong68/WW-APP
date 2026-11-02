import { describe, expect, it } from 'vitest'
import { shouldApplyUpdate } from './appUpdate'

describe('When a new version of the app takes over', () => {
  it('at once when nothing is being edited', () => {
    expect(shouldApplyUpdate({ editing: 0, hidden: false })).toBe(true)
  })
  it('never while a form is open on screen', () => {
    expect(shouldApplyUpdate({ editing: 1, hidden: false })).toBe(false)
  })
  it('when the app goes to the background', () => {
    expect(shouldApplyUpdate({ editing: 2, hidden: true })).toBe(true)
  })
})
