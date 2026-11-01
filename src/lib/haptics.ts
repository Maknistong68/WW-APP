// One place for the phone's little buzzes. Silent where vibration isn't
// supported (iPhone Safari) and while the tab is hidden.

export type HapticKind = 'tick' | 'press' | 'success' | 'warn'

/** tick: selections and swipe thresholds · press: long-press · success: done · warn: overdue. */
export function hapticPattern(kind: HapticKind): number | number[] {
  switch (kind) {
    case 'tick':
      return 8
    case 'press':
      return 12
    case 'success':
      return [10, 60, 18]
    case 'warn':
      return [24, 50, 24]
  }
}

export function haptic(kind: HapticKind): void {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
    if (typeof document !== 'undefined' && document.hidden) return
    navigator.vibrate(hapticPattern(kind))
  } catch {
    // no haptics
  }
}
