import { describe, expect, it } from 'vitest'
import { authProblemText, emailProblem, nameProblem, normUsername, parseLogin, passwordChecks, passwordProblem, retypeProblem, signUpProblem, usernameProblem } from './authForm'

describe('A username', () => {
  it('is typed loosely and kept clean: lower case, no @, no spaces around', () => {
    expect(normUsername('  @Ali.Hassan ')).toBe('ali.hassan')
  })
  it('3 to 24 letters or numbers, with . _ - inside', () => {
    expect(usernameProblem('ali')).toBeNull()
    expect(usernameProblem('ali_h-2.x')).toBeNull()
    expect(usernameProblem('al')).toMatch(/3 to 24/)
    expect(usernameProblem('a'.repeat(25))).toMatch(/3 to 24/)
    expect(usernameProblem('ali hassan')).toMatch(/letters or numbers/)
    expect(usernameProblem('.ali')).toMatch(/letter or number/)
    expect(usernameProblem('')).toBe('Choose a username')
  })
})

describe('A name', () => {
  it('needed, and at most 60 letters', () => {
    expect(nameProblem('Ali Hassan')).toBeNull()
    expect(nameProblem('  ')).toBe('Type your name')
    expect(nameProblem('x'.repeat(61))).toMatch(/60/)
  })
})

describe('Signing in with a username or an email', () => {
  it('an @ inside means an email; anything else is a username', () => {
    expect(parseLogin(' Ali@Example.com ')).toEqual({ kind: 'email', value: 'ali@example.com' })
    expect(parseLogin('@Ali ')).toEqual({ kind: 'username', value: 'ali' })
    expect(parseLogin('ali')).toEqual({ kind: 'username', value: 'ali' })
  })
})

describe('Passwords and new accounts', () => {
  it('a password: 8 or more, with a letter and a number', () => {
    expect(passwordProblem('')).toBe('Type a password')
    expect(passwordProblem('abc123')).toBe('Use at least 8 characters')
    expect(passwordProblem('12345678')).toBe('Use a letter and a number')
    expect(passwordProblem('abcdefgh')).toBe('Use a letter and a number')
    expect(passwordProblem('welfare1')).toBeNull()
  })
  it('typed twice, the same both times', () => {
    expect(retypeProblem('welfare1', '')).toBe('Type the password again')
    expect(retypeProblem('welfare1', 'welfare2')).toBe('The passwords don’t match')
    expect(retypeProblem('welfare1', 'welfare1')).toBeNull()
  })
  it('the checklist ticks as you type', () => {
    const ok = (pw: string, again: string) => passwordChecks(pw, again).map((c) => c.ok)
    expect(passwordChecks('', '').map((c) => c.label)).toEqual(['At least 8 characters', 'A letter and a number', 'Both passwords match'])
    expect(ok('abc', '')).toEqual([false, false, false])
    expect(ok('abcdefg1', '')).toEqual([true, true, false])
    expect(ok('abcdefg1', 'abcdefg1')).toEqual([true, true, true])
    expect(ok('abcdefg1', 'abcdefg2')).toEqual([true, true, false])
  })
  it('an email that looks like one', () => {
    expect(emailProblem('')).toBe('Type your email')
    expect(emailProblem('ali@')).toBe('Check the email')
    expect(emailProblem('ali@example.com')).toBeNull()
  })
  it('a new account: name, email, password, the same password again (no username)', () => {
    const ok = { name: 'Ali Hassan', email: 'ali@example.com', password: 'welfare1', again: 'welfare1' }
    expect(signUpProblem(ok)).toBeNull()
    expect(signUpProblem({ ...ok, name: '' })).toBe('Type your name')
    expect(signUpProblem({ ...ok, email: 'x' })).toBe('Check the email')
    expect(signUpProblem({ ...ok, password: 'short', again: 'short' })).toBe('Use at least 8 characters')
    expect(signUpProblem({ ...ok, again: 'welfare2' })).toBe('The passwords don’t match')
  })
})

describe('Sign-in errors in plain words', () => {
  it('no internet, too many tries, an email already used', () => {
    expect(authProblemText(new TypeError('Failed to fetch'))).toBe('No internet. Try again when you’re online.')
    expect(authProblemText(new Error('Email rate limit exceeded'))).toBe('Too many tries. Wait a few minutes, then try again.')
    expect(authProblemText(new Error('User already registered'))).toBe('This email already has an account. Sign in instead.')
    expect(authProblemText(new Error('Invalid login credentials'))).toBe('Wrong username, email or password.')
    expect(authProblemText(new Error('Email not confirmed'))).toBe('Confirm your email first: open the link we sent you.')
  })
})
