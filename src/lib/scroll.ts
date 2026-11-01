import { useSyncExternalStore } from 'react'

// One passive window scroll listener for the whole app, batched to one
// callback per frame. The collapsing app bar reads the position; the tab bar
// reads the direction (hide on scroll down, show on scroll up).

export type ScrollDir = 'up' | 'down'
export interface DirState {
  dir: ScrollDir
  /** Furthest point in the current direction. */
  anchor: number
}

/** Move this far against the current direction before it flips. */
export const DIR_HYSTERESIS = 8
/** Near the top or bottom the bars always show. */
export const EDGE = 24

/** Pure: the scroll direction after moving to `y` (max = furthest scroll). */
export function nextDir(prev: DirState, y: number, max: number): DirState {
  if (y < EDGE || max < EDGE * 4 || y > max - EDGE) return { dir: 'up', anchor: y }
  if (prev.dir === 'down') {
    if (y > prev.anchor) return { dir: 'down', anchor: y }
    return prev.anchor - y > DIR_HYSTERESIS ? { dir: 'up', anchor: y } : prev
  }
  if (y < prev.anchor) return { dir: 'up', anchor: y }
  return y - prev.anchor > DIR_HYSTERESIS ? { dir: 'down', anchor: y } : prev
}

const yListeners = new Set<(y: number) => void>()
const dirListeners = new Set<() => void>()
let state: DirState = { dir: 'up', anchor: 0 }
let raf = 0
let attached = false

function frame() {
  raf = 0
  // reads first, then writes (listeners), so no forced layout
  const y = window.scrollY
  const max = document.documentElement.scrollHeight - window.innerHeight
  const next = nextDir(state, y, max)
  const flipped = next.dir !== state.dir
  state = next
  for (const f of yListeners) f(y)
  if (flipped) for (const f of dirListeners) f()
}

const onScroll = () => {
  if (!raf) raf = requestAnimationFrame(frame)
}

function attach() {
  if (attached || typeof window === 'undefined') return
  attached = true
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll, { passive: true })
}

/** Called once per frame while scrolling (and right away by syncScroll). */
export function subscribeScrollY(fn: (y: number) => void): () => void {
  attach()
  yListeners.add(fn)
  return () => yListeners.delete(fn)
}

/** Push the current position to everyone now (e.g. after a screen change). */
export function syncScroll() {
  if (typeof window === 'undefined') return
  if (raf) cancelAnimationFrame(raf)
  frame()
}

/** Show the bars again (new screen). */
export function resetScrollDir() {
  if (typeof window === 'undefined') return
  const was = state.dir
  state = { dir: 'up', anchor: window.scrollY }
  if (was !== 'up') for (const f of dirListeners) f()
}

const subscribeDir = (fn: () => void) => {
  attach()
  dirListeners.add(fn)
  return () => {
    dirListeners.delete(fn)
  }
}

/** 'down' while the person scrolls down the page, else 'up'. */
export function useScrollDir(): ScrollDir {
  return useSyncExternalStore(
    subscribeDir,
    () => state.dir,
    () => 'up',
  )
}

let suppressUntil = 0
/** Stop the app bar snapping for a while (programmatic scrolls). */
export function suppressSnap(ms = 700) {
  suppressUntil = Math.max(suppressUntil, Date.now() + ms)
}
export const snapSuppressed = () => Date.now() < suppressUntil

/** Run `fn` when scrolling has stopped and the finger is up. */
export function onScrollSettled(fn: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  if ('onscrollend' in (window as object)) {
    window.addEventListener('scrollend', fn)
    return () => window.removeEventListener('scrollend', fn)
  }
  let timer = 0
  let touching = false
  const later = () => {
    window.clearTimeout(timer)
    if (!touching) timer = window.setTimeout(fn, 140)
  }
  const down = () => {
    touching = true
    window.clearTimeout(timer)
  }
  const up = () => {
    touching = false
    later()
  }
  window.addEventListener('scroll', later, { passive: true })
  window.addEventListener('touchstart', down, { passive: true })
  window.addEventListener('touchend', up, { passive: true })
  window.addEventListener('touchcancel', up, { passive: true })
  return () => {
    window.clearTimeout(timer)
    window.removeEventListener('scroll', later)
    window.removeEventListener('touchstart', down)
    window.removeEventListener('touchend', up)
    window.removeEventListener('touchcancel', up)
  }
}

/**
 * Scroll to `y` now; if the page is still too short (content arriving), keep
 * trying for up to a second unless the person touches the screen.
 */
export function restoreScroll(y: number) {
  if (typeof window === 'undefined') return
  if (y > 0) suppressSnap(600)
  window.scrollTo(0, y)
  if (y <= 0 || Math.abs(window.scrollY - y) < 2 || typeof ResizeObserver === 'undefined') return
  const ro = new ResizeObserver(() => {
    window.scrollTo(0, y)
    if (Math.abs(window.scrollY - y) < 2) stop()
  })
  const stop = () => {
    ro.disconnect()
    window.clearTimeout(timer)
    window.removeEventListener('touchstart', stop)
    window.removeEventListener('wheel', stop)
  }
  const timer = window.setTimeout(stop, 1000)
  window.addEventListener('touchstart', stop, { passive: true })
  window.addEventListener('wheel', stop, { passive: true })
  ro.observe(document.body)
}
