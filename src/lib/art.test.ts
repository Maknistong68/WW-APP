import { describe, expect, it } from 'vitest'
import { hash, initials } from './art'

describe('tile helpers', () => {
  it('stable hash and initials', () => {
    expect(hash('WWCMPL0001')).toBe(hash('WWCMPL0001'))
    expect(hash('a')).not.toBe(hash('b'))
    expect([initials('Al Fahad Contracting'), initials('RPCO'), initials('')]).toEqual(['AF', 'RP', '·'])
  })
})
