import { useEffect, useRef, useState } from 'react'
import { syncAudit } from './sync'

/** How often an open audit checks the other device, and how soon a change goes out. */
export const LIVE_PULL_MS = 5000
export const LIVE_PUSH_MS = 2000

/** live: in step with the cloud · offline: kept on this device, sent when back online · off: no cloud sync here */
export type LiveState = 'live' | 'offline' | 'off'

/**
 * A Worker Welfare audit open on this device keeps in step with the same audit
 * open on another (laptop and phone): a change goes out ~2 s after it's made,
 * and the other device's answers and photos come in every 5 s while the screen
 * is on (src/lib/sync.ts `syncAudit`). `changedAt` is the audit's save time on
 * this device.
 */
export function useLiveAudit(uuid: string | undefined, on: boolean, readOnly: boolean, changedAt: string | undefined): LiveState {
  const [state, setState] = useState<LiveState>(() => (navigator.onLine ? 'off' : 'offline'))
  const everLive = useRef(false)

  const run = useRef<() => void>(() => {})
  run.current = () => {
    if (!uuid || !on) return
    if (!navigator.onLine) return setState('offline')
    if (document.visibilityState !== 'visible') return
    syncAudit(uuid, readOnly).then(
      (r) => {
        if (r) everLive.current = true
        setState(r || everLive.current ? 'live' : 'off')
      },
      () => setState('offline'),
    )
  }

  // every 5 s while on screen; at once when the screen or the connection comes back
  useEffect(() => {
    if (!uuid || !on) return
    run.current()
    const tick = window.setInterval(() => run.current(), LIVE_PULL_MS)
    const again = () => run.current()
    const offline = () => setState('offline')
    document.addEventListener('visibilitychange', again)
    window.addEventListener('online', again)
    window.addEventListener('offline', offline)
    return () => {
      window.clearInterval(tick)
      document.removeEventListener('visibilitychange', again)
      window.removeEventListener('online', again)
      window.removeEventListener('offline', offline)
    }
  }, [uuid, on])

  // a change made here goes out ~2 s later (the editor saves it within half a second)
  useEffect(() => {
    if (!uuid || !on || !changedAt) return
    const t = window.setTimeout(() => run.current(), LIVE_PUSH_MS)
    return () => window.clearTimeout(t)
  }, [uuid, on, changedAt])

  return state
}

/** The mark at the end of the audit's progress line: a word, and what it means (shown on hold / hover). */
export const liveMark = (s: LiveState): { label: string; title: string } | null =>
  s === 'live'
    ? { label: 'Live', title: 'Open on your laptop and phone at once: answers and photos show on both within seconds.' }
    : s === 'offline'
      ? { label: 'Offline', title: 'Saved on this device. It goes to your other device when you’re back online.' }
      : null
