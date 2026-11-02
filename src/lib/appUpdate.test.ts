import { describe, expect, it } from 'vitest'
import { shouldApplyUpdate } from './appUpdate'

describe('When a new version of the app takes over', () => {
  it('right after the app opens, or while it is in the background, with nothing being edited', () => {
    expect(shouldApplyUpdate({ editing: 0, hidden: false, fresh: true })).toBe(true)
    expect(shouldApplyUpdate({ editing: 0, hidden: true })).toBe(true)
  })
  it('not while someone is reading a screen (the Update ready toast offers it instead)', () => {
    expect(shouldApplyUpdate({ editing: 0, hidden: false })).toBe(false)
  })
  it('never while a form is open on screen', () => {
    expect(shouldApplyUpdate({ editing: 1, hidden: false, fresh: true })).toBe(false)
  })
  it('not even in the background: taking a photo or switching to WhatsApp hides the page with the form still open', () => {
    expect(shouldApplyUpdate({ editing: 2, hidden: true })).toBe(false)
  })
})
