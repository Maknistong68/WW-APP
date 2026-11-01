import { describe, expect, it } from 'vitest'
import { cubicBezier, easeSine80 } from './motion'

describe('cubicBezier', () => {
  it('starts at 0 and ends at 1', () => {
    expect(easeSine80(0)).toBe(0)
    expect(easeSine80(1)).toBe(1)
    expect(easeSine80(-1)).toBe(0)
    expect(easeSine80(2)).toBe(1)
  })
  it('linear curve is the identity', () => {
    const lin = cubicBezier(0, 0, 1, 1)
    for (const t of [0.1, 0.25, 0.5, 0.9]) expect(lin(t)).toBeCloseTo(t, 4)
  })
  it('sine 80 is ahead of linear in the middle and never goes back', () => {
    expect(easeSine80(0.5)).toBeGreaterThan(0.5)
    let prev = 0
    for (let i = 1; i <= 100; i++) {
      const v = easeSine80(i / 100)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })
})
