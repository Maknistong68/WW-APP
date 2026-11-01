import { describe, expect, it } from 'vitest'
import { springStep, type Spring } from './spring'

describe('spring', () => {
  it('settles on the target', () => {
    const s: Spring = { x: 0, v: 0 }
    for (let i = 0; i < 240; i++) springStep(s, 1, 1 / 60)
    expect(s.x).toBeCloseTo(1, 3)
    expect(Math.abs(s.v)).toBeLessThan(1e-3)
  })

  it('overshoots a little (the bounce) and stays stable on a long frame', () => {
    const s: Spring = { x: 0, v: 0 }
    let max = 0
    for (let i = 0; i < 120; i++) {
      springStep(s, 1, 1 / 60)
      max = Math.max(max, s.x)
    }
    expect(max).toBeGreaterThan(1.05)
    expect(max).toBeLessThan(1.6)
    const t: Spring = { x: 0, v: 0 }
    springStep(t, 1, 5)
    expect(Number.isFinite(t.x)).toBe(true)
  })
})
