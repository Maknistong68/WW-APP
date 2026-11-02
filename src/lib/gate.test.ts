import { describe, expect, it } from 'vitest'
import { gateScreen } from './gate'

describe('Which screen opens first', () => {
  it('nothing until the account is known', () => {
    expect(gateScreen({ phase: 'loading', setPassword: false, install: false })).toBe('loading')
  })
  it('not signed in: sign in', () => {
    expect(gateScreen({ phase: 'signedOut', setPassword: false, install: false })).toBe('login')
  })
  it('back from an invite or a reset link: set the password first', () => {
    expect(gateScreen({ phase: 'approved', setPassword: true, install: false })).toBe('setPassword')
    expect(gateScreen({ phase: 'pending', setPassword: true, install: false })).toBe('setPassword')
  })
  it('waiting for the admin, or no access', () => {
    expect(gateScreen({ phase: 'pending', setPassword: false, install: false })).toBe('waiting')
    expect(gateScreen({ phase: 'rejected', setPassword: false, install: false })).toBe('waiting')
  })
  it('approved, or a phone with no cloud account: the app', () => {
    expect(gateScreen({ phase: 'approved', setPassword: false, install: false })).toBe('app')
    expect(gateScreen({ phase: 'local', setPassword: false, install: false })).toBe('app')
  })
  it('a phone in a browser tab: install first (after a password to set), signed in or not', () => {
    expect(gateScreen({ phase: 'signedOut', setPassword: false, install: true })).toBe('install')
    expect(gateScreen({ phase: 'approved', setPassword: false, install: true })).toBe('install')
    expect(gateScreen({ phase: 'approved', setPassword: true, install: true })).toBe('setPassword')
    expect(gateScreen({ phase: 'loading', setPassword: false, install: true })).toBe('loading')
  })
})
