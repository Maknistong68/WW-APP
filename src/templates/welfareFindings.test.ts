import { describe, expect, it } from 'vitest'
import { WELFARE_FINDINGS } from './welfareFindings'
import { WELFARE_COMMENTS } from './welfareComments'
import { getTemplate } from '.'

const codes = getTemplate('welfare_audit')!.sections.flatMap((s) => s.questions.map((q) => q.code))
const all = Object.entries(WELFARE_FINDINGS).flatMap(([code, f]) => [...f.no, ...f.partial].map((text) => ({ code, text })))
const words = (t: string) => t.trim().split(/\s+/).length

describe('Researched findings for the Worker Welfare audit', () => {
  it('every question has 3 findings for No and 2 for Partial', () => {
    expect(Object.keys(WELFARE_FINDINGS).sort()).toEqual([...codes].sort())
    for (const code of codes) {
      expect(WELFARE_FINDINGS[code].no, code).toHaveLength(3)
      expect(WELFARE_FINDINGS[code].partial, code).toHaveLength(2)
    }
  })
  it('each is a full finding: 15–28 words, ending with a full stop', () => {
    const off = all.filter(({ text }) => words(text) < 15 || words(text) > 28 || !text.endsWith('.'))
    expect(off.map(({ code, text }) => `${code} (${words(text)}): ${text}`)).toEqual([])
  })
  it('no praise, no client name, no ID numbers', () => {
    const praise = /\b(good|great|excellent|commendable|well done|positive|appreciated|impressive|outstanding)\b/i
    const client = new RegExp('ne' + 'om', 'i')
    for (const { code, text } of all) {
      expect(text, code).not.toMatch(praise)
      expect(text, code).not.toMatch(client)
      expect(text, code).not.toMatch(/\d{5,}/)
    }
  })
  it('no repeats within a question, and none copies the checklist’s own short comment', () => {
    for (const code of codes) {
      const mine = [...WELFARE_FINDINGS[code].no, ...WELFARE_FINDINGS[code].partial]
      expect(new Set(mine).size, code).toBe(mine.length)
      for (const c of WELFARE_COMMENTS[code] ?? []) expect(mine, code).not.toContain(c)
    }
  })
})
