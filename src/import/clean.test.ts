import { describe, expect, it } from 'vitest'
import {
  cleanCategory,
  cleanChannel,
  cleanIssue,
  cleanPriority,
  cleanStatus,
  parseDate,
  parseSheetDate,
  toPct,
  unifyNames,
} from './clean'

describe('import cleaners', () => {
  it('parses every date shape in the old files', () => {
    expect(parseDate(new Date(Date.UTC(2026, 9, 20, 15, 55)))).toBe('2026-10-20')
    expect(parseDate('16-12-2024 17:04:16')).toBe('2024-12-16')
    expect(parseDate('2026-04-12 18:15:27')).toBe('2026-04-12')
    expect(parseDate(46000)).toBe('2025-12-09')
    expect(parseDate({ formula: 'X', result: new Date(Date.UTC(2026, 0, 2)) })).toBe('2026-01-02')
    expect(parseDate('')).toBe('')
    expect(parseDate('n/a')).toBe('')
  })
  it('parses weekly tab names', () => {
    expect(parseSheetDate('03-JAN-2025')).toBe('2025-01-03')
    expect(parseSheetDate('20-Apr-2025')).toBe('2025-04-20')
    expect(parseSheetDate('24-May-2026')).toBe('2026-05-24')
    expect(parseSheetDate('Overall')).toBe('')
  })
  it('unifies priorities, statuses and channels', () => {
    expect(['2-High', '2 - High', '2 -High', '3-Moderate', 'Critical', ''].map(cleanPriority)).toEqual([2, 2, 2, 3, 1, 2])
    expect(['Closed', 'open', 'Inprogress', ''].map(cleanStatus)).toEqual(['Closed', 'Open', 'In progress', ''])
    expect(['WhatsApp (Chatbot)', 'WhatsApp Chatbot', 'Worker Hotline', 'Welfare Internal'].map(cleanChannel)).toEqual([
      'WhatsApp Chatbot', 'WhatsApp Chatbot', 'Worker Hotline', 'Welfare Internal',
    ])
  })
  it('maps categories and issues', () => {
    expect(cleanCategory('Employment Practice', 'Off-Boarding')).toBe('Off-Boarding')
    expect(cleanCategory('Liveability', 'Accommodation')).toBe('Accommodation')
    expect(cleanCategory('Livability- Transportation')).toBe('Transportation')
    expect(cleanIssue('Final Salary')).toBe('Final salary')
    expect(cleanIssue('', 'salary not received')).toBe('Salary not received')
    expect(cleanIssue('No Overtime Pay')).toBe('Overtime not paid')
    expect(cleanIssue('Overcrowded Bedrooms, Bathrooms Requirments not met')).toBe('Accommodation standards')
    expect(cleanIssue('No Ajeer')).toBe('Informal worker / No Ajeer')
  })
  it('percentages from fractions or whole numbers', () => {
    expect([0.83, 83, '75%', '', 1].map(toPct)).toEqual([83, 83, 75, null, 100])
  })
  it('unifies inspector spellings', () => {
    const m = unifyNames(['Asim Jan', 'ASIM Jan', 'Asim Jan', 'Mohamed  Ibrahim', 'Mohammed Ibrahim', 'Mohammed Ibrahim', 'Muhammed Heera', 'Muhammad Heera', 'Muhammad Heera'])
    expect(m.get('ASIM Jan')).toBe('Asim Jan')
    expect(m.get('Mohamed  Ibrahim')).toBe('Mohammed Ibrahim')
    expect(m.get('Muhammed Heera')).toBe('Muhammad Heera')
  })
})
