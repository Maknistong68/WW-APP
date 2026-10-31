import { describe, expect, it } from 'vitest'
import { mentions, nameKey, sameCompany } from './names'

describe('contractor names', () => {
  it('strips legal words, punctuation and work-order numbers', () => {
    expect(nameKey('Al Fahad-882')).toBe(nameKey('AL FAHAD'))
    expect(nameKey('Abyatona Real Estate Development Company')).toBe('abyatona')
    expect(nameKey('Abyatona-1112')).toBe('abyatona')
  })
  it('matches spelling variants', () => {
    expect(sameCompany('Alfahd Trading Industry & Contracting Co', 'Al Fahad')).toBe(true)
    expect(sameCompany('El Seif-Power China-Hassan Allam JV', 'El Seif-Hassan Allam- Power china JV')).toBe(true)
    expect(sameCompany('RPCO', 'PPCO')).toBe(false)
    expect(sameCompany('SIBS', 'Specialist Independent Building Services')).toBe(false)
    expect(sameCompany('AM Tamimi', 'Abdul Mohsin Al Tamimi')).toBe(true)
    expect(sameCompany('AM Tamimi', 'Tamimi Group')).toBe(false)
  })
  it('finds a contractor mentioned in free text', () => {
    expect(mentions('Al Fahad Trading – Camp 3', ['Alfahd'])).toBe(true)
    expect(mentions('RPCO camp', ['PPCO'])).toBe(false)
  })
})
