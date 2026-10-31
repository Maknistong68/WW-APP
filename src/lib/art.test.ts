import { describe, expect, it } from 'vitest'
import { coverGradient, initials, sectionOf } from './art'

describe('cover art', () => {
  it('is stable for the same name and section', () => {
    expect(coverGradient('tickets', 'WWCMPL0001')).toBe(coverGradient('tickets', 'WWCMPL0001'))
    expect(coverGradient('contractors', 'RPCO')).not.toBe(coverGradient('tickets', 'RPCO'))
  })
  it('sections from routes, initials from names', () => {
    expect([sectionOf('/'), sectionOf('/tickets/x'), sectionOf('/missing/formal'), sectionOf('/closeouts')]).toEqual([
      'home',
      'tickets',
      'kpi',
      'closeout',
    ])
    expect([initials('Al Fahad Contracting'), initials('RPCO'), initials('')]).toEqual(['AF', 'RP', '·'])
  })
})
