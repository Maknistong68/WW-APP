import { describe, expect, it } from 'vitest'
import { mentions, nameKey, sameCompany, shortName } from './names'

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
  it('shortens a name by dropping filler words from its end', () => {
    expect(shortName('Project Pioneers Contracting Company')).toBe('Project Pioneers')
    expect(shortName('Nesma & Partners Contracting Company')).toBe('Nesma & Partners')
    expect(shortName('Six Construct Co. Ltd Branch')).toBe('Six Construct')
    expect(shortName('ElSeif Redco Joint Venture')).toBe('ElSeif Redco')
    expect(shortName('MBL-SIXCO-BOSKALIS JV')).toBe('MBL-SIXCO-BOSKALIS')
    expect(shortName('Tamimi Group')).toBe('Tamimi')
  })
  it('drops a cut-off last word and a dangling "and" / "for"', () => {
    expect(shortName('United Maintenance and Contracting Compa')).toBe('United Maintenance')
    expect(shortName('Abduallah Ahmed_Albriki_Est_For_Con')).toBe('Abduallah Ahmed Albriki')
  })
  it('keeps the middle of a name, short names and the first word', () => {
    expect(shortName('Advanced Construction Technology Service')).toBe('Advanced Construction Technology')
    expect(shortName('DSV Air and Sea for Logi')).toBe('DSV Air and Sea for Logi')
    expect(shortName('RPCO')).toBe('RPCO')
    expect(shortName('Group')).toBe('Group')
    expect(shortName('  ')).toBe('')
  })
})
