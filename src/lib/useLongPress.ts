import { useCallback, useRef, type MouseEvent, type PointerEvent } from 'react'
import { setAnchor } from './anchor'
import { haptic } from './haptics'

/** Hold this long to trigger. */
export const LONG_PRESS_MS = 450
/** Moving further than this cancels (it's a scroll or a swipe). */
export const MOVE_TOLERANCE = 8

/**
 * Long-press for touch and mouse. While held the element sinks a little
 * (`.holding`, a 450 ms "charge"); at 450 ms there's a haptic press, the held
 * element becomes the menu's anchor (so the pop-up grows out of it) and
 * `onLongPress` runs. Right-click and the keyboard's menu key do the same.
 * The click that follows a long press is swallowed.
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
    el.current?.classList.remove('holding')
  }, [])

  if (!onLongPress) return {}

  const fire = (target: HTMLElement) => {
    fired.current = true
    cancel()
    setAnchor(target.getBoundingClientRect())
    haptic('press')
    onLongPress()
  }

  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      fired.current = false
      if (e.button !== 0) return
      start.current = { x: e.clientX, y: e.clientY }
      el.current = e.currentTarget
      el.current.classList.add('holding')
      const target = e.currentTarget
      timer.current = window.setTimeout(() => fire(target), LONG_PRESS_MS)
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (!start.current) return
      if (Math.abs(e.clientX - start.current.x) > MOVE_TOLERANCE || Math.abs(e.clientY - start.current.y) > MOVE_TOLERANCE) cancel()
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    /** Right-click, the menu key, or the phone's own long-press: open the menu once. */
    onContextMenu: (e: MouseEvent<HTMLElement>) => {
      e.preventDefault()
      if (fired.current && timer.current === undefined && start.current === null && el.current === e.currentTarget) {
        // the phone's own long-press arriving after ours: already open
        return
      }
      fire(e.currentTarget)
    },
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
