import { describe, expect, it } from 'vitest'
import { shouldApplyUpdate } from './appUpdate'

describe('When a new version of the app takes over', () => {
  it('at once when nothing is being edited', () => {
    expect(shouldApplyUpdate({ editing: 0, hidden: false })).toBe(true)
    expect(shouldApplyUpdate({ editing: 0, hidden: true })).toBe(true)
  })
  it('never while a form is open on screen', () => {
    expect(shouldApplyUpdate({ editing: 1, hidden: false })).toBe(false)
  })
  it('not even in the background: taking a photo or switching to WhatsApp hides the page with the form still open', () => {
    expect(shouldApplyUpdate({ editing: 2, hidden: true })).toBe(false)
  })
})
