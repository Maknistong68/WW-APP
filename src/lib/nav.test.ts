import { beforeEach, describe, expect, it } from 'vitest'
import { navKind, previousEntry, recordEntry, rememberScroll, resetEntries, scrollTarget, shouldAnimate } from './nav'

const k = (from: string, to: string, type: 'POP' | 'PUSH' | 'REPLACE' = 'PUSH', via?: string, fromIdx = 1, toIdx = 2) =>
  navKind({ from, to, type, fromIdx, toIdx, via })

describe('navKind', () => {
  it('same screen (search change) has no screen motion', () => {
    expect(k('/dashboard', '/dashboard')).toBe('none')
  })
  it('switching between the four tabs fades', () => {
    expect(k('/', '/tickets')).toBe('tab')
    expect(k('/contractors', '/dashboard', 'PUSH', 'tab')).toBe('tab')
  })
  it('opening a screen pushes; Back buttons and history back go back', () => {
    expect(k('/tickets', '/tickets/abc')).toBe('push')
    expect(k('/tickets/abc', '/tickets', 'PUSH', 'back')).toBe('back')
    expect(k('/tickets/abc', '/tickets', 'POP', undefined, 3, 2)).toBe('back')
    expect(k('/tickets', '/tickets/abc', 'POP', undefined, 2, 3)).toBe('push')
    // a tab-opened entry reached again by history back is still "back"
    expect(k('/tickets/abc', '/tickets', 'POP', 'tab', 3, 2)).toBe('back')
  })
  it('redirects fade', () => {
    expect(k('/new/x', '/inspection/1', 'REPLACE')).toBe('fade')
  })
  it('the 3D view is never animated, nor a move the browser animated', () => {
    expect(shouldAnimate('/dashboard', '/dashboard/3d', false)).toBe(false)
    expect(shouldAnimate('/dashboard/3d', '/dashboard', false)).toBe(false)
    expect(shouldAnimate('/a', '/b', true)).toBe(false)
    expect(shouldAnimate('/a', '/b', false)).toBe(true)
  })
})

describe('history and scroll memory', () => {
  beforeEach(resetEntries)
  it('knows the previous entry, and a push cuts the forward ones', () => {
    recordEntry(0, '/', 'INITIAL')
    recordEntry(1, '/tickets', 'PUSH')
    recordEntry(2, '/tickets/a', 'PUSH')
    expect(previousEntry(2)).toBe('/tickets')
    recordEntry(1, '/tickets', 'POP')
    recordEntry(2, '/library', 'PUSH')
    expect(previousEntry(2)).toBe('/tickets')
    expect(previousEntry(0)).toBeUndefined()
  })
  it('back restores, tabs keep their place, new screens start at the top', () => {
    rememberScroll('k1', '/tickets', 420)
    expect(scrollTarget('back', 'k1', '/tickets')).toBe(420)
    expect(scrollTarget('back', 'other', '/tickets')).toBe(420)
    expect(scrollTarget('tab', 'k9', '/tickets')).toBe(420)
    expect(scrollTarget('tab', 'k9', '/library')).toBe(0)
    expect(scrollTarget('push', 'k1', '/tickets')).toBe(0)
    expect(scrollTarget('none', 'k1', '/tickets')).toBeNull()
  })
})
