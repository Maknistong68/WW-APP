import { describe, expect, it } from 'vitest'
import { passwordFlag, readPasswordFlag } from './passwordFlag'

describe('"Set your password" belongs to the person the link was for', () => {
  it('asks the invited person', () => {
    expect(readPasswordFlag(passwordFlag('u-mona', 'invite'), 'u-mona')).toBe('invite')
  })
  it('never asks someone else who signs in on the same phone', () => {
    expect(readPasswordFlag(passwordFlag('u-mona', 'invite'), 'u-admin')).toBe('')
  })
  it('nothing kept, or an old unreadable value: nothing to ask', () => {
    expect(readPasswordFlag(null, 'u-mona')).toBe('')
    expect(readPasswordFlag('1', 'u-mona')).toBe('')
  })
})
