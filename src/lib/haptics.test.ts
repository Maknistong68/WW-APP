import { afterEach, describe, expect, it, vi } from 'vitest'
import { haptic, hapticPattern } from './haptics'

describe('Haptics', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('a light tick, a firmer press, a double tap for success, a long buzz for warnings', () => {
    expect(hapticPattern('tick')).toBe(8)
    expect(hapticPattern('press')).toBe(12)
    expect(hapticPattern('success')).toEqual([10, 60, 18])
    expect(hapticPattern('warn')).toEqual([24, 50, 24])
  })
  it('vibrates with the pattern when the phone can', () => {
    const vibrate = vi.fn(() => true)
    vi.stubGlobal('navigator', { vibrate })
    vi.stubGlobal('document', { hidden: false })
    haptic('success')
    expect(vibrate).toHaveBeenCalledWith([10, 60, 18])
  })
  it('stays silent without vibration support (iPhone) or in a hidden tab', () => {
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('document', { hidden: false })
    expect(() => haptic('tick')).not.toThrow()
    const vibrate = vi.fn(() => true)
    vi.stubGlobal('navigator', { vibrate })
    vi.stubGlobal('document', { hidden: true })
    haptic('tick')
    expect(vibrate).not.toHaveBeenCalled()
  })
})
