import { describe, expect, it } from 'vitest'
import { formatCount, parseCount } from './countUp'

describe('parseCount', () => {
  it('reads numbers and number-like text', () => {
    expect(parseCount(12)).toMatchObject({ value: 12, decimals: 0, suffix: '' })
    expect(parseCount('87%')).toMatchObject({ value: 87, suffix: '%' })
    expect(parseCount('1,234')).toMatchObject({ value: 1234, grouped: true })
    expect(parseCount('12K')).toMatchObject({ value: 12, suffix: 'K' })
    expect(parseCount('1.2M')).toMatchObject({ value: 1.2, decimals: 1, suffix: 'M' })
    expect(parseCount('SAR 1.2M')).toMatchObject({ prefix: 'SAR ', value: 1.2, suffix: 'M' })
    expect(parseCount('99+')).toBeNull()
  })
  it('leaves dashes, dates and words alone', () => {
    for (const v of ['—', '–', '12 May 2026', '2026-05-01', 'Open', '', null, undefined, NaN]) expect(parseCount(v)).toBeNull()
    expect(parseCount('1,23')).toBeNull()
  })
})

describe('formatCount', () => {
  it('prints in-between values in the final shape', () => {
    const c = parseCount('SAR 1,234.5K')!
    expect(formatCount(c, 0)).toBe('SAR 0.0K')
    expect(formatCount(c, 1234.5)).toBe('SAR 1,234.5K')
    expect(formatCount(parseCount('87%')!, 43.6)).toBe('44%')
    expect(formatCount(parseCount(7)!, 6.6)).toBe('7')
  })
})
