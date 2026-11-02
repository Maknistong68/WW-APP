import { describe, expect, it } from 'vitest'
import { DEFAULT_ORDER, greeting, moveSection, normalizeOrder } from './homeLayout'

describe('Home sections: order', () => {
  it('starts with Start here, All areas, Watch, Month progress', () => {
    expect(DEFAULT_ORDER).toEqual(['start', 'areas', 'watch', 'progress'])
  })

  it('keeps a saved order and adds sections it did not know', () => {
    expect(normalizeOrder(['watch', 'start'])).toEqual(['watch', 'start', 'areas', 'progress'])
  })

  it('drops unknown or repeated names and anything that is not a list', () => {
    expect(normalizeOrder(['areas', 'nope', 'areas', 7, 'start'])).toEqual(['areas', 'start', 'watch', 'progress'])
    expect(normalizeOrder('start')).toEqual(DEFAULT_ORDER)
    expect(normalizeOrder(null)).toEqual(DEFAULT_ORDER)
  })

  it('moves one section up or down, and not past either end', () => {
    expect(moveSection(DEFAULT_ORDER, 'watch', -1)).toEqual(['start', 'watch', 'areas', 'progress'])
    expect(moveSection(DEFAULT_ORDER, 'start', 1)).toEqual(['areas', 'start', 'watch', 'progress'])
    expect(moveSection(DEFAULT_ORDER, 'start', -1)).toEqual(DEFAULT_ORDER)
    expect(moveSection(DEFAULT_ORDER, 'progress', 1)).toEqual(DEFAULT_ORDER)
  })

  it('never changes the list it was given', () => {
    const order = [...DEFAULT_ORDER]
    moveSection(order, 'areas', 1)
    expect(order).toEqual(DEFAULT_ORDER)
  })
})

describe('Home greeting', () => {
  it('follows the time of day', () => {
    expect(greeting(6)).toBe('Good morning')
    expect(greeting(11)).toBe('Good morning')
    expect(greeting(12)).toBe('Good afternoon')
    expect(greeting(16)).toBe('Good afternoon')
    expect(greeting(17)).toBe('Good evening')
    expect(greeting(2)).toBe('Good evening')
  })
})
