import { useEffect, useRef, type RefObject } from 'react'

// The phone's Back closes the open panel (sheet, dialog, quick actions,
// drawer) instead of leaving the screen.
//
// While any panel is open there is one extra history entry on top, with the
// same URL (so HashRouter doesn't navigate) and the router's own state kept
// (so its index is unchanged). Back pops it: the top panel closes, and the
// entry comes back if another panel is still open or the top one stays (a
// "Discard changes?" prompt). When the last panel closes some other way, our
// entry is taken off again. An entry left under a new screen (a panel that
// navigated) is skipped when Back reaches it.

type Layer = { back: () => boolean | void }
const layers: Layer[] = []
/** popstates we caused ourselves (history.back() to drop or skip our entry). */
let ownPops = 0

const ours = () => {
  const s = typeof window === 'undefined' ? null : (window.history.state as { wwSheet?: unknown } | null)
  return !!s && typeof s === 'object' && s.wwSheet === true
}
function push() {
  const s = window.history.state as Record<string, unknown> | null
  window.history.pushState({ ...(s && typeof s === 'object' ? s : {}), wwSheet: true }, '')
}
function dropOurs() {
  ownPops++
  window.history.back()
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (ownPops > 0) {
      ownPops--
      // a panel opened while our entry was on its way out: give it one again
      if (layers.length && !ours()) push()
      return
    }
    if (ours()) {
      // reached a leftover entry (its panel is gone): step over it
      if (!layers.length) dropOurs()
      return
    }
    const top = layers[layers.length - 1]
    if (!top) return
    const stays = top.back() === true
    if (stays || layers.length > 1) push()
  })
}

function add(layer: Layer) {
  if (!layers.length && !ours()) push()
  layers.push(layer)
}
function remove(layer: Layer) {
  const i = layers.indexOf(layer)
  if (i >= 0) layers.splice(i, 1)
  if (layers.length) return
  // Wait a tick: StrictMode re-runs effects, and a panel may swap for another
  // (Create → Ticket); both keep the same entry.
  window.setTimeout(() => {
    if (!layers.length && ours()) dropOurs()
  }, 0)
}

/**
 * While `open`, the phone's Back calls `onBack` instead of leaving the screen.
 * Return true from `onBack` to stay open (e.g. to ask first).
 */
export function useBackClose(open: boolean, onBack: () => boolean | void): () => boolean {
  const cb = useRef(onBack)
  cb.current = onBack
  const mine = useRef<Layer | null>(null)
  useEffect(() => {
    if (!open || typeof window === 'undefined') return
    const layer: Layer = { back: () => cb.current() }
    mine.current = layer
    add(layer)
    return () => {
      remove(layer)
      if (mine.current === layer) mine.current = null
    }
  }, [open])
  /** True when this panel is the top one (Escape and Tab belong to it). */
  return useRef(() => !mine.current || layers[layers.length - 1] === mine.current).current
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Keeps Tab / Shift+Tab inside `ref` while `on` (and `isTop()`, for stacked panels). */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, on = true, isTop: () => boolean = () => true) {
  const top = useRef(isTop)
  top.current = isTop
  useEffect(() => {
    if (!on) return
    const onKey = (e: KeyboardEvent) => {
      const box = ref.current
      if (e.key !== 'Tab' || !box || !top.current()) return
      const items = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement)
      if (!items.length) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (!box.contains(active)) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [ref, on])
}
