import { useEffect, useRef, useState } from 'react'
import { syncAudit } from './sync'

/** How often an open audit checks the other device, and how soon a change goes out. */
export const LIVE_PULL_MS = 5000
export const LIVE_PUSH_MS = 2000

/**
 * live: the last quick sync got through · offline: no internet (kept on this device, sent when back)
 * · stuck: online but the last try failed or took too long · off: no cloud sync here (or not tried yet)
 */
export type LiveState = 'live' | 'offline' | 'stuck' | 'off'

/**
 * A Worker Welfare audit open on this device keeps in step with the same audit
 * open on another (laptop and phone): a change goes out ~2 s after it's made,
 * and the other device's answers and photos come in every 5 s while the screen
 * is on (src/lib/sync.ts `syncAudit`). `editedAt` changes only when the person
 * here edits the audit: a copy arriving from the other device never starts another
 * round (that made the phone re-send the same audit every couple of seconds).
 */
export function useLiveAudit(uuid: string | undefined, on: boolean, readOnly: boolean, editedAt: number): LiveState {
  const [state, setState] = useState<LiveState>(() => (navigator.onLine ? 'off' : 'offline'))
  const everLive = useRef(false)

  const run = useRef<() => void>(() => {})
  run.current = () => {
    if (!uuid || !on) return
    if (!navigator.onLine) return setState('offline')
    if (document.visibilityState !== 'visible') return
    syncAudit(uuid, readOnly).then(
      (r) => {
        if (r) {
          everLive.current = true
          setState('live')
        } else if (!everLive.current) setState((s) => (s === 'stuck' ? s : 'off'))
        // null with a full sync running: keep what the mark says
      },
      () => setState(navigator.onLine ? 'stuck' : 'offline'),
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
    if (!uuid || !on || !editedAt) return
    const t = window.setTimeout(() => run.current(), LIVE_PUSH_MS)
    return () => window.clearTimeout(t)
  }, [uuid, on, editedAt])

  return state
}

/** The mark at the end of the audit's progress line: a word, and what it means (shown on hold / hover). */
export const liveMark = (s: LiveState): { label: string; title: string } | null =>
  s === 'live'
    ? { label: 'Live', title: 'Open on your laptop and phone at once: answers and photos show on both within seconds.' }
    : s === 'offline'
      ? { label: 'Offline', title: 'Saved on this device. It goes to your other device when you’re back online.' }
      : s === 'stuck'
        ? { label: 'Not syncing', title: 'Online, but the last try didn’t get through. Saved on this device. Tap Sync now in Settings, or see Settings › Sync log.' }
        : null
