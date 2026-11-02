import { describe, expect, it } from 'vitest'
import { chipScrollLeft } from './chipScroll'

// A 360 px row (scrolled to 0) with a 16 px gutter on each side.
const row = { scrollLeft: 0, clientWidth: 360 }

describe('Keeping the chosen chip in view', () => {
  it('a chip already fully in view stays put', () => {
    expect(chipScrollLeft(row, { start: 100, width: 80 }, 16)).toBeNull()
  })
  it('a chip cut off on the right scrolls in, with the gutter after it', () => {
    expect(chipScrollLeft(row, { start: 317, width: 68 }, 16)).toBe(317 + 68 + 16 - 360)
  })
  it('a chip cut off on the left scrolls in, with the gutter before it', () => {
    expect(chipScrollLeft({ scrollLeft: 200, clientWidth: 360 }, { start: 150, width: 80 }, 16)).toBe(134)
  })
  it('never scrolls before the start', () => {
    expect(chipScrollLeft({ scrollLeft: 20, clientWidth: 360 }, { start: 4, width: 60 }, 16)).toBe(0)
  })
})
