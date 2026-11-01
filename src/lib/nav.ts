import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

// Screen-change bookkeeping: which way a navigation goes (push / back / tab
// switch), where each screen was scrolled to, and what the previous history
// entry is, so a Back button can really go back.

export type NavKind = 'initial' | 'push' | 'back' | 'tab' | 'fade' | 'none'
export type NavType = 'POP' | 'PUSH' | 'REPLACE'

/** The four bottom-bar screens. */
export const TAB_ROOTS = ['/', '/tickets', '/dashboard', '/library']

/** Hint put in location.state by Back buttons and the tab bar. */
export interface NavState {
  nav?: 'back' | 'tab'
}

export function navKind({
  from,
  to,
  type,
  fromIdx,
  toIdx,
  via,
}: {
  from: string
  to: string
  type: NavType
  fromIdx: number | null
  toIdx: number | null
  via?: string
}): NavKind {
  if (from === to) return 'none'
  if (TAB_ROOTS.includes(from) && TAB_ROOTS.includes(to)) return 'tab'
  // history back/forward: the entry's own hint (how it was first opened) doesn't apply
  if (type === 'POP') return fromIdx !== null && toIdx !== null && toIdx > fromIdx ? 'push' : 'back'
  if (via === 'tab') return 'tab'
  if (via === 'back') return 'back'
  if (type === 'REPLACE') return 'fade'
  return 'push'
}

/** No screen animation into or out of the 3D view (WebGL snapshots are costly). */
export function shouldAnimate(from: string, to: string, browserAnimated: boolean): boolean {
  if (browserAnimated) return false
  return !from.startsWith('/dashboard/3d') && !to.startsWith('/dashboard/3d')
}

// ---- history entries (path + search per history index) -------------------
const entries: (string | undefined)[] = []

export function recordEntry(idx: number | null, path: string, type: NavType | 'INITIAL') {
  if (idx === null || idx < 0) return
  if (type === 'PUSH') entries.length = idx
  entries[idx] = path
}

export const previousEntry = (idx: number | null) => (idx !== null && idx > 0 ? entries[idx - 1] : undefined)

export function historyIdx(): number | null {
  if (typeof window === 'undefined') return null
  const idx = (window.history.state as { idx?: unknown } | null)?.idx
  return typeof idx === 'number' ? idx : null
}

/** For tests. */
export function resetEntries() {
  entries.length = 0
  byKey.clear()
  byPath.clear()
}

// ---- scroll memory -------------------------------------------------------
const byKey = new Map<string, number>()
const byPath = new Map<string, number>()

export function rememberScroll(key: string, path: string, y: number) {
  byKey.set(key, y)
  byPath.set(path, y)
}

/** Where a screen should open: back restores, tabs keep their place, new screens start at the top. */
export function scrollTarget(kind: NavKind, key: string, path: string): number | null {
  if (kind === 'none' || kind === 'initial') return null
  if (kind === 'back') return byKey.get(key) ?? byPath.get(path) ?? 0
  if (kind === 'tab') return byPath.get(path) ?? 0
  return 0
}

// ---- the browser's own back animation -------------------------------------
let browserAnimated = false
if (typeof window !== 'undefined') {
  // Registered at import, before the router's listener, so the flag is set
  // before React re-renders for this popstate.
  window.addEventListener('popstate', (e) => {
    browserAnimated = (e as PopStateEvent).hasUAVisualTransition === true
  })
}
/** True once after a back/forward the browser already animated (edge swipe). */
export function takeBrowserAnimated(): boolean {
  const v = browserAnimated
  browserAnimated = false
  return v
}

/**
 * Back button: real history back when the previous screen is the target (so
 * its scroll comes back), else open the target marked as a "back" move.
 */
export function useGoBack() {
  const navigate = useNavigate()
  return useCallback(
    (to: string) => {
      if (to === '..') return navigate(-1)
      if (previousEntry(historyIdx()) === to) return navigate(-1)
      navigate(to, { state: { nav: 'back' } satisfies NavState })
    },
    [navigate],
  )
}
