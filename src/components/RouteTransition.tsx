import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { useLocation, useNavigationType, type Location } from 'react-router-dom'
import { reducedMotion } from '../lib/motion'
import {
  historyIdx,
  navKind,
  recordEntry,
  rememberScroll,
  scrollTarget,
  shouldAnimate,
  takeBrowserAnimated,
  type NavKind,
  type NavState,
} from '../lib/nav'
import { resetScrollDir, restoreScroll, syncScroll } from '../lib/scroll'

/** The screen on display and how it arrived. It trails the router's location
 *  by one View Transition, so the old screen can be captured first. */
export interface Shown {
  location: Location
  kind: NavKind
}

const Ctx = createContext<Shown | null>(null)

/** The shown screen (use instead of useLocation outside <Routes>). */
export function useShown(): Shown {
  const ctx = useContext(Ctx)
  const location = useLocation()
  return ctx ?? { location, kind: 'initial' }
}
export const useShownLocation = () => useShown().location

const canAnimate = () => typeof document !== 'undefined' && typeof document.startViewTransition === 'function'

/**
 * One UI screen motion. Opening a screen slides it in from the right while
 * the old one drifts left and dims; Back does the reverse; the four tabs fade
 * through. Runs on the View Transitions API (snapshots, so sticky and fixed
 * bars move with their screen); without it, screens fade in. New screens open
 * at the top, Back returns to where you were.
 */
export default function NavProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navType = useNavigationType()
  const [shown, setShown] = useState<Shown>(() => ({ location, kind: 'initial' }))
  const shownRef = useRef(shown)
  shownRef.current = shown
  const idxRef = useRef<number | null>(null)
  const running = useRef<ReturnType<Document['startViewTransition']> | null>(null)

  useLayoutEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
    if (canAnimate()) document.documentElement.setAttribute('data-vt', '')
    idxRef.current = historyIdx()
    recordEntry(idxRef.current, shownRef.current.location.pathname + shownRef.current.location.search, 'INITIAL')
  }, [])

  useEffect(() => {
    const from = shownRef.current.location
    // Same object = nothing new (first mount, StrictMode's second run). Keys
    // alone can't tell: hash changes made outside the router all use 'default'.
    if (location === from) return
    const toIdx = historyIdx()
    const browserAnimated = takeBrowserAnimated()
    const kind = navKind({
      from: from.pathname,
      to: location.pathname,
      type: navType,
      fromIdx: idxRef.current,
      toIdx,
      via: (location.state as NavState | null)?.nav,
    })
    idxRef.current = toIdx
    recordEntry(toIdx, location.pathname + location.search, navType)
    rememberScroll(from.key, from.pathname + from.search, window.scrollY)

    const commit = () => {
      document.documentElement.dataset.nav = kind
      setShown({ location, kind })
    }
    running.current?.skipTransition()
    if (
      !canAnimate() ||
      kind === 'none' ||
      reducedMotion() ||
      document.visibilityState !== 'visible' ||
      !shouldAnimate(from.pathname, location.pathname, browserAnimated)
    ) {
      commit()
      return
    }
    // The callback runs outside React's render, so flushSync is safe; layout
    // effects (scroll restore, body flags, header state) land in the new snapshot.
    const vt = document.startViewTransition(() => flushSync(commit))
    running.current = vt
    vt.ready.catch(() => {})
    vt.updateCallbackDone.catch(() => {})
    vt.finished
      .catch(() => {})
      .finally(() => {
        if (running.current === vt) running.current = null
      })
  }, [location, navType])

  // New screen: put the scroll where it belongs before it is painted/captured.
  useLayoutEffect(() => {
    if (shown.kind === 'initial') return
    const { key, pathname, search } = shown.location
    const y = scrollTarget(shown.kind, key, pathname + search)
    if (y !== null) restoreScroll(y)
    if (shown.kind !== 'none') resetScrollDir()
    syncScroll()
  }, [shown])

  return <Ctx.Provider value={shown}>{children}</Ctx.Provider>
}
