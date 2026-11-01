import { describe, expect, it } from 'vitest'
import { niceMax, segments } from './chartScale'

describe('Chart scale', () => {
  it('a 100% month keeps the axis at 100, not 200', () => {
    expect(niceMax(100)).toBe(100)
    expect(niceMax(85)).toBe(100)
  })
  it('rounds up to 1, 2 or 5 steps, at least 5', () => {
    expect(niceMax(0)).toBe(5)
    expect(niceMax(3)).toBe(5)
    expect(niceMax(120)).toBe(200)
    expect(niceMax(250)).toBe(500)
    expect(niceMax(1000)).toBe(1000)
  })
  it('no-data points split a line into runs instead of dropping to 0', () => {
    expect(segments([1, null, 2, 3, null])).toEqual([[0], [2, 3]])
    expect(segments([null, null])).toEqual([])
    expect(segments([4, 5])).toEqual([[0, 1]])
  })
})
