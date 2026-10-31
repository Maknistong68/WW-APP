import { useCallback, useRef, type PointerEvent } from 'react'

/** Hold this long to trigger. */
export const LONG_PRESS_MS = 450
/** Moving further than this cancels (it's a scroll or a swipe). */
export const MOVE_TOLERANCE = 8

/**
 * Long-press for touch and mouse: a haptic tick, the element lifts while held,
 * and the click that follows a long press is swallowed.
 */
export function useLongPress(onLongPress: (() => void) | undefined) {
  const timer = useRef<number | undefined>(undefined)
  const start = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)
  const el = useRef<HTMLElement | null>(null)

  const cancel = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = undefined
    start.current = null
    el.current?.classList.remove('lifting')
  }, [])

  if (!onLongPress) return {}

  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return
      fired.current = false
      start.current = { x: e.clientX, y: e.clientY }
      el.current = e.currentTarget
      el.current.classList.add('lifting')
      timer.current = window.setTimeout(() => {
        fired.current = true
        el.current?.classList.remove('lifting')
        try {
          navigator.vibrate?.(12)
        } catch {
          // no haptics
        }
        onLongPress()
      }, LONG_PRESS_MS)
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (!start.current) return
      if (Math.abs(e.clientX - start.current.x) > MOVE_TOLERANCE || Math.abs(e.clientY - start.current.y) > MOVE_TOLERANCE) cancel()
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    /** Use as the capture-phase click guard: true when the click came from a long press. */
    onClickCapture: (e: { stopPropagation: () => void; preventDefault: () => void }) => {
      if (fired.current) {
        fired.current = false
        e.stopPropagation()
        e.preventDefault()
      }
    },
  }
}
