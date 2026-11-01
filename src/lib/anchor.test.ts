import { describe, expect, it } from 'vitest'
import { setAnchor, takeAnchor } from './anchor'

const r = { top: 1, bottom: 2, left: 3, right: 4, width: 1, height: 1 }

describe('Where the menu was opened from', () => {
  it('hands the held item over once, right away', () => {
    setAnchor(r, 1000)
    expect(takeAnchor(1100)).toEqual(r)
    expect(takeAnchor(1100)).toBeUndefined()
  })
  it('forgets it after a moment so a later menu opens as a sheet', () => {
    setAnchor(r, 1000)
    expect(takeAnchor(2000)).toBeUndefined()
  })
})
