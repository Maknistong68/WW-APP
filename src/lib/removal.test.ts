import { describe, expect, it } from 'vitest'
import { removalProblem } from './removal'

describe('Removing a ticket needs a reason', () => {
  it('a few words at least', () => {
    expect(removalProblem('')).toBe('Say why it is being removed')
    expect(removalProblem('  dup ')).toBe('Say why in a few more words')
    expect(removalProblem('Duplicate of WWCMPL0009617')).toBeNull()
  })
})
