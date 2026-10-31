import { describe, expect, it } from 'vitest'
import { resolveTheme } from './theme'

describe('theme', () => {
  it('auto follows the phone; a picked theme wins', () => {
    expect(resolveTheme('auto', false)).toBe('light')
    expect(resolveTheme('auto', true)).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})
