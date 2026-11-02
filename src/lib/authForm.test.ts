import { describe, expect, it } from 'vitest'
import { authProblemText, emailProblem, nameProblem, normUsername, parseLogin, passwordProblem, signUpProblem, usernameProblem } from './authForm'

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
  it('a password of 8 or more', () => {
    expect(passwordProblem('')).toBe('Type a password')
    expect(passwordProblem('1234567')).toBe('Use at least 8 characters')
    expect(passwordProblem('12345678')).toBeNull()
  })
  it('an email that looks like one', () => {
    expect(emailProblem('')).toBe('Type your email')
    expect(emailProblem('ali@')).toBe('Check the email')
    expect(emailProblem('ali@example.com')).toBeNull()
  })
  it('a new account checks every field, top to bottom', () => {
    const ok = { name: 'Ali Hassan', username: 'ali', email: 'ali@example.com', password: '12345678' }
    expect(signUpProblem(ok)).toBeNull()
    expect(signUpProblem({ ...ok, name: '' })).toBe('Type your name')
    expect(signUpProblem({ ...ok, username: 'a' })).toMatch(/3 to 24/)
    expect(signUpProblem({ ...ok, email: 'x' })).toBe('Check the email')
    expect(signUpProblem({ ...ok, password: 'short' })).toBe('Use at least 8 characters')
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
