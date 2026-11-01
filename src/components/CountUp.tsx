import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { formatCount, parseCount } from '../lib/countUp'
import { easeSine80, reducedMotion } from '../lib/motion'
import { useShown } from './RouteTransition'

const DURATION = 700

/**
 * A number that rolls up to its value: from 0 when it first appears, from the
 * old value when it changes. Not on Back (the screen was seen already), not
 * with reduced motion. Text that isn't a number ("—", dates) shows as is.
 * Screen readers get the final value only.
 */
export default function CountUp({ value }: { value: ReactNode }) {
  const text = typeof value === 'number' || typeof value === 'string' ? String(value) : null
  const target = text === null ? null : parseCount(value)
  const { kind } = useShown()
  const span = useRef<HTMLSpanElement>(null)
  /** What is on screen now (mid-animation too). */
  const current = useRef<number | null>(null)
  const entry = useRef(kind)

  useLayoutEffect(() => {
    const el = span.current
    if (!el || !target || text === null) return
    const from = current.current ?? (entry.current === 'back' ? target.value : 0)
    if (from === target.value || reducedMotion()) {
      current.current = target.value
      el.textContent = text
      return
    }
    let raf = 0
    const start = performance.now()
    const paint = (t: number) => {
      const v = from + (target.value - from) * easeSine80(t)
      current.current = v
      el.textContent = t >= 1 ? text : formatCount(target, v)
    }
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION)
      paint(t)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    paint(0)
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  if (!target || text === null) return <>{value}</>
  return (
    <>
      <span ref={span} aria-hidden="true" />
      <span className="sr-only">{text}</span>
    </>
  )
}
