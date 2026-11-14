import { describe, expect, it } from 'vitest'
import { WALK_REMINDER, WELFARE_PLACES } from './welfareWalk'
import { getTemplate } from '.'

describe('The audit by place', () => {
  const codes = getTemplate('welfare_audit')!.sections.flatMap((s) => s.questions.map((q) => q.code))
  const placed = WELFARE_PLACES.flatMap((p) => p.items.map((i) => i.code))

  it('has every question, each in exactly one place', () => {
    expect(placed).toHaveLength(118)
    expect(new Set(placed).size).toBe(118)
    expect([...placed].sort()).toEqual([...codes].sort())
  })
  it('keeps the checklist order inside each place', () => {
    for (const p of WELFARE_PLACES) {
      const idx = p.items.map((i) => codes.indexOf(i.code))
      expect(idx).toEqual([...idx].sort((a, b) => a - b))
    }
  })
  it('gives short reminders, without the client’s name', () => {
    const name = new RegExp('ne' + 'om', 'i')
    for (const [code, r] of WALK_REMINDER) {
      expect(r.length, code).toBeLessThanOrEqual(75)
      expect(r, code).not.toMatch(name)
    }
  })
})
