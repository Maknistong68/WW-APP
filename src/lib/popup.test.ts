import { describe, expect, it } from 'vitest'
import { placePopup } from './popup'

const vp = { width: 390, height: 844 }
const rect = (top: number, height: number, left = 16, width = 358) => ({ top, bottom: top + height, left, right: left + width, width, height })

describe('Pop-up placement', () => {
  it('opens below the held item when it fits, growing from its top edge', () => {
    const p = placePopup(rect(100, 76), { width: 320, height: 300 }, vp)
    expect(p.mode).toBe('below')
    expect(p.top).toBe(184)
    expect(p.originY).toBe(0)
  })
  it('opens above when there is no room below, growing from its bottom edge', () => {
    const p = placePopup(rect(600, 76), { width: 320, height: 300 }, vp)
    expect(p.mode).toBe('above')
    expect(p.top).toBe(600 - 8 - 300)
    expect(p.originY).toBe(300)
  })
  it('docks at the bottom when it fits on neither side, still growing from the held item', () => {
    const p = placePopup(rect(300, 76), { width: 320, height: 500 }, vp)
    expect(p.mode).toBe('dock')
    expect(p.top).toBe(844 - 12 - 500)
    expect([p.left, p.width]).toEqual([12, 366])
    expect(p.originY).toBe(300 + 38 - p.top)
    expect(p.originX).toBe(16 + 179 - 12)
  })
  it('a menu taller than the screen docks at the top margin and scrolls', () => {
    expect(placePopup(rect(300, 76), { width: 320, height: 900 }, vp).top).toBe(12)
  })
  it('stays inside the screen edges and points its origin at the held item', () => {
    const p = placePopup(rect(100, 40, 330, 44), { width: 320, height: 200 }, vp)
    expect(p.left).toBe(390 - 12 - 320)
    expect(p.originX).toBe(330 + 22 - p.left)
    const wide = placePopup(rect(100, 40), { width: 600, height: 200 }, vp)
    expect([wide.left, wide.width]).toEqual([12, 366])
  })
})
