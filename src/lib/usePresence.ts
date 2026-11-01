import { useEffect, useState } from 'react'
import { reducedMotion } from './motion'

/**
 * Keep something on screen a little after it is closed, so it can animate
 * out. `closing` is true during that time.
 */
export function usePresence(open: boolean, exitMs: number) {
  const [phase, setPhase] = useState<'hidden' | 'open' | 'closing'>(open ? 'open' : 'hidden')
  useEffect(() => {
    if (open) setPhase('open')
    else setPhase((p) => (p === 'hidden' ? p : reducedMotion() ? 'hidden' : 'closing'))
  }, [open])
  useEffect(() => {
    if (phase !== 'closing') return
    const t = window.setTimeout(() => setPhase('hidden'), exitMs)
    return () => window.clearTimeout(t)
  }, [phase, exitMs])
  return { mounted: open || phase !== 'hidden', closing: !open && phase === 'closing' }
}
