import { describe, expect, it } from 'vitest'
import { gateScreen } from './gate'

describe('Which screen opens first', () => {
  it('nothing until the account is known', () => {
    expect(gateScreen({ phase: 'loading', setPassword: false })).toBe('loading')
  })
  it('not signed in: sign in', () => {
    expect(gateScreen({ phase: 'signedOut', setPassword: false })).toBe('login')
  })
  it('back from an invite or a reset link: set the password first', () => {
    expect(gateScreen({ phase: 'approved', setPassword: true })).toBe('setPassword')
    expect(gateScreen({ phase: 'pending', setPassword: true })).toBe('setPassword')
  })
  it('waiting for the admin, or no access', () => {
    expect(gateScreen({ phase: 'pending', setPassword: false })).toBe('waiting')
    expect(gateScreen({ phase: 'rejected', setPassword: false })).toBe('waiting')
  })
  it('approved, or a phone with no cloud account: the app', () => {
    expect(gateScreen({ phase: 'approved', setPassword: false })).toBe('app')
    expect(gateScreen({ phase: 'local', setPassword: false })).toBe('app')
  })
})
