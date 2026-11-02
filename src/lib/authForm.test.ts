import { describe, expect, it } from 'vitest'
import { nameProblem, normUsername, usernameProblem } from './authForm'

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
