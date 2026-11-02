import { describe, expect, it } from 'vitest'
import { pushRing } from './localLog'

describe('The fallback log kept outside the database', () => {
  it('keeps the newest first', () => {
    expect(pushRing([2, 1], 3, 5)).toEqual([3, 2, 1])
  })
  it('drops the oldest past the limit', () => {
    expect(pushRing([3, 2, 1], 4, 3)).toEqual([4, 3, 2])
  })
})
